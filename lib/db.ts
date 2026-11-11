import "server-only";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA, DROP, SCHEMA_VERSION } from "./schema";

/**
 * Database access layer.
 * - With DATABASE_URL (or POSTGRES_URL from the Vercel Supabase integration):
 *   Supabase / any Postgres through node-postgres.
 * - Without it: an embedded PostgreSQL (PGlite) stored in ./data/pg for local use.
 * The first connection creates the tables and seeds the demo data.
 * Exposes a tiny API: q (many rows), one (first row), tx (transaction).
 */

export type Row = Record<string, any>;
export interface Queryable {
  q<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Row>(sql: string, params?: unknown[]): Promise<T | null>;
}
interface Driver extends Queryable {
  tx<T>(fn: (t: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  embedded: boolean;
}

type Client = { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> };

const wrap = (c: Client): Queryable => ({
  async q<T>(sql: string, params: unknown[] = []) {
    return (await c.query(sql, params)).rows as T[];
  },
  async one<T>(sql: string, params: unknown[] = []) {
    return ((await c.query(sql, params)).rows[0] as T) ?? null;
  },
});

export const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

async function makePglite(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), "data", "pg");
  fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir, {
    parsers: {
      1700: (v: string) => parseFloat(v), // numeric
      20: (v: string) => parseInt(v, 10), // int8
      1082: (v: string) => v, // date stays a string
    },
  });
  await db.waitReady;
  return {
    ...wrap(db),
    tx: (fn) => db.transaction((t) => fn(wrap(t))),
    exec: async (sql) => {
      await db.exec(sql);
    },
    embedded: true,
  };
}

async function makePg(url: string): Promise<Driver> {
  const pg = await import("pg");
  pg.default.types.setTypeParser(1700, parseFloat);
  pg.default.types.setTypeParser(20, (v: string) => parseInt(v, 10));
  pg.default.types.setTypeParser(1082, (v: string) => v);
  // Supabase needs SSL; the pooler's certificate chain is not in Node's store.
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new pg.default.Pool({
    connectionString: url.replace(/[?&]sslmode=[^&]*/, ""),
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: 3,
  });
  return {
    ...wrap(pool),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const r = await fn(wrap(client));
        await client.query("COMMIT");
        return r;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    exec: async (sql) => {
      await pool.query(sql);
    },
    embedded: false,
  };
}

/**
 * Create tables (idempotent) and seed the demo once. Serialised with an advisory lock.
 * A database from an older SCHEMA_VERSION is wiped and rebuilt.
 */
async function init(d: Driver) {
  await d.tx(async (t) => {
    if (!d.embedded) await t.q("select pg_advisory_xact_lock(4920)");
    const hasMeta = await t.one<{ r: string | null }>("select to_regclass('public.meta')::text as r");
    const version = hasMeta?.r ? (await t.one<{ value: string }>("select value from meta where key = 'schema'"))?.value : null;
    if (version !== SCHEMA_VERSION) await t.q(DROP);
    for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await t.q(stmt);
    await t.q("insert into meta (key, value) values ('schema', $1) on conflict (key) do update set value = excluded.value", [SCHEMA_VERSION]);
  });
  await d.tx(async (t) => {
    if (!d.embedded) await t.q("select pg_advisory_xact_lock(4921)");
    const seeded = await t.one<{ n: number }>("select count(*)::int as n from users");
    if (seeded!.n === 0) {
      const { seed } = await import("./seed");
      await seed(t);
    }
  });
  // Readable web addresses: every applicant gets a name slug, jobs drop the company prefix.
  await d.tx(async (t) => {
    const { fixSlugs } = await import("./slug-fix");
    await fixSlugs(t);
  });
  await syncOwner(d);
}

/**
 * Keep the owner login in step with OWNER_EMAIL / OWNER_PASSWORD / OWNER_NAME.
 * The owner is created once, so without this, changing these settings on Vercel later would do nothing.
 */
async function syncOwner(d: Driver) {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim();
  if (!email && !password && !name) return;
  const owner = await d.one<{ id: number; email: string; name: string; password_hash: string }>("select id, email, name, password_hash from users where kind = 'owner' order by id limit 1");
  if (!owner) return;
  const bcrypt = (await import("bcryptjs")).default;
  const newEmail = email || owner.email;
  const newName = name || owner.name;
  const samePassword = !password || (await bcrypt.compare(password, owner.password_hash));
  if (newEmail === owner.email && newName === owner.name && samePassword) return;
  const hash = samePassword ? owner.password_hash : await bcrypt.hash(password!, 10);
  await d.q("update users set email = $1, name = $2, password_hash = $3 where id = $4", [newEmail, newName, hash, owner.id]);
}

const g = globalThis as unknown as { __callaDb?: Promise<Driver>; __callaTimer?: NodeJS.Timeout };

async function boot(): Promise<Driver> {
  const url = databaseUrl();
  const d = url ? await makePg(url) : await makePglite();
  await init(d);
  // Local server only: interview reminders once a minute. On Vercel a cron job calls /api/cron.
  if (d.embedded && !g.__callaTimer) {
    g.__callaTimer = setInterval(() => {
      import("./booking").then((m) => m.runReminders()).catch((e) => console.error("[reminders]", e));
    }, 60_000);
    g.__callaTimer.unref();
  }
  return d;
}

function driver() {
  if (!g.__callaDb)
    g.__callaDb = boot().catch((e) => {
      g.__callaDb = undefined;
      throw e;
    });
  return g.__callaDb;
}

export const db: Queryable & { tx<T>(fn: (t: Queryable) => Promise<T>): Promise<T> } = {
  async q(sql, params) {
    return (await driver()).q(sql, params);
  },
  async one(sql, params) {
    return (await driver()).one(sql, params);
  },
  async tx(fn) {
    return (await driver()).tx(fn);
  },
};

/** Wipe everything and re-seed the demo clinic (daily demo reset). */
export async function resetDatabase() {
  const d = await driver();
  if (d.embedded) await d.exec(DROP);
  else await d.tx(async (t) => {
    await t.q("select pg_advisory_xact_lock(4920)");
    await t.q(DROP);
  });
  await init(d);
}
