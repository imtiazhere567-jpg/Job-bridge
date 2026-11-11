import "server-only";
import crypto from "node:crypto";
import { db, type Queryable } from "./db";
import { companyForRole, logActivity, send, templates } from "./messages";
import type { Applicant, Role } from "./types";

/**
 * Mark an applicant as hired and send them the good news.
 * When hires reach the role's number of openings, the role closes automatically
 * (it disappears from the job board and stops taking applications).
 */
export async function hire(applicantId: number) {
  const a = await db.one<Applicant>("select * from applicants where id = $1", [applicantId]);
  if (!a || a.stage === "hired") return { filled: false };
  const role = (await db.one<Role>("select * from roles where id = $1", [a.role_id]))!;
  const company = await companyForRole(role.id);
  return db.tx(async (t) => {
    await t.q("update applicants set stage = 'hired', updated_at = now() where id = $1", [a.id]);
    const m = templates.hired(a, role, company);
    await send(t, a, "hired", m.subject, m.body);
    await logActivity(t, `${a.name} hired as ${role.title}`, role.id, a.id);
    const { n } = (await t.one<{ n: number }>("select count(*)::int as n from applicants where role_id = $1 and stage = 'hired'", [role.id]))!;
    if (n >= role.openings && role.status === "open") {
      await t.q("update roles set status = 'closed', closed_reason = 'filled', updated_at = now() where id = $1", [role.id]);
      await logActivity(t, `All ${role.openings} position${role.openings > 1 ? "s" : ""} filled. ${role.title} closed automatically`, role.id);
      return { filled: true, hired: n };
    }
    return { filled: false, hired: n };
  });
}

/** Hires so far for a role. */
export const hiredCount = async (roleId: number, t: Queryable = db) =>
  (await t.one<{ n: number }>("select count(*)::int as n from applicants where role_id = $1 and stage = 'hired'", [roleId]))!.n;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "item";

/** Unique slug in a table ("companies", "roles" or "applicants"). */
export async function uniqueSlug(table: "companies" | "roles" | "applicants", base: string, ignoreId = 0, t: Queryable = db) {
  const root = slugify(base);
  let slug = root;
  const taken = async (s: string) =>
    !!(await t.one(`select 1 from ${table} where slug = $1 and id <> $2`, [s, ignoreId])) ||
    // a job's old name still points to that job, so a new job can't take it
    (table === "roles" && !!(await t.one("select 1 from role_slugs where slug = $1 and role_id <> $2", [s, ignoreId])));
  for (let i = 2; await taken(slug); i++) slug = `${root}-${i}`;
  return slug;
}

/** Keep a job's previous web name, so links already shared still open it. */
export async function rememberSlug(roleId: number, oldSlug: string, t: Queryable = db) {
  await t.q("insert into role_slugs (slug, role_id) values ($1, $2) on conflict (slug) do update set role_id = excluded.role_id", [oldSlug, roleId]);
}

/** Short share code for /j/<code> links. */
export async function newRoleCode(t: Queryable = db) {
  for (;;) {
    const code = crypto.randomBytes(4).toString("base64url").replace(/[-_]/g, "").slice(0, 6).toLowerCase();
    if (code.length === 6 && !(await t.one("select 1 from roles where code = $1", [code]))) return code;
  }
}
