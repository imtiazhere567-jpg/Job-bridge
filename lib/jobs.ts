import "server-only";
import { db } from "./db";
import { COMPANY_COLS } from "./messages";
import type { Company, Role } from "./types";

export type JobRow = Role & { company_name: string; company_slug: string; brand_color: string; logo_type: string | null; industry: string | null; hired: number };

const JOB_SELECT = `select r.*, c.name as company_name, c.slug as company_slug, c.brand_color, c.logo_type, c.industry,
  (select count(*)::int from applicants a where a.role_id = r.id and a.stage = 'hired') as hired
  from roles r join companies c on c.id = r.company_id`;

/** Approved, open roles for the public job board. */
export async function openJobs(f: { q?: string; city?: string; type?: string; mode?: string; company?: number } = {}) {
  const where = ["r.status = 'open'"];
  const args: unknown[] = [];
  if (f.q) where.push(`(r.title ilike $${args.push(`%${f.q}%`)} or c.name ilike $${args.length} or r.department ilike $${args.length})`);
  if (f.city) where.push(`coalesce(r.city, c.city) ilike $${args.push(f.city)}`);
  if (f.type) where.push(`r.employment = $${args.push(f.type)}`);
  if (f.mode) where.push(`r.work_mode = $${args.push(f.mode)}`);
  if (f.company) where.push(`r.company_id = $${args.push(f.company)}`);
  return db.q<JobRow>(`${JOB_SELECT} where ${where.join(" and ")} order by r.reviewed_at desc nulls last, r.created_at desc`, args);
}

/** A job by its web name ("customer-support-officer") or short share code (old links, posters, website snippet). */
export async function jobByCode(ref: string) {
  const key = decodeURIComponent(ref).toLowerCase();
  const role =
    (await db.one<JobRow>(`${JOB_SELECT} where r.slug = $1 or r.code = $1 order by (r.slug = $1) desc limit 1`, [key])) ??
    // a link made before the job was renamed
    (await db.one<JobRow>(`${JOB_SELECT} where r.id = (select role_id from role_slugs where slug = $1)`, [key]));
  if (!role) return null;
  const company = (await db.one<Company>(`select ${COMPANY_COLS} from companies where id = $1`, [role.company_id]))!;
  return { role, company };
}

export async function jobBySlug(slug: string) {
  const role = await db.one<JobRow>(`${JOB_SELECT} where r.slug = $1`, [slug]);
  if (!role) return null;
  const company = (await db.one<Company>(`select ${COMPANY_COLS} from companies where id = $1`, [role.company_id]))!;
  return { role, company };
}

export async function cities() {
  return (await db.q<{ city: string }>("select distinct coalesce(r.city, c.city) as city from roles r join companies c on c.id = r.company_id where r.status = 'open' and coalesce(r.city, c.city) is not null order by 1")).map((r) => r.city);
}
