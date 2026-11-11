import "server-only";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import type { Applicant, Role } from "./types";

/** A role that belongs to this company, or a 404. Stops one company reaching another's data. */
export async function ownRole(roleId: number, companyId: number) {
  const role = await db.one<Role>("select * from roles where id = $1 and company_id = $2", [roleId, companyId]);
  if (!role) notFound();
  return role;
}

const isId = (p: string) => /^\d+$/.test(p);

/**
 * A job from the web address: "/roles/video-editor". Old number addresses ("/roles/5")
 * still work and move to the readable one. `sub` is the rest of the path, e.g. "/poster".
 */
export async function roleByParam(param: string, companyId: number, sub = "") {
  const p = decodeURIComponent(param);
  const role =
    (await db.one<Role>(`select * from roles where ${isId(p) ? "id = $1::int" : "slug = $1"} and company_id = $2`, [p, companyId])) ??
    (isId(p) ? null : await db.one<Role>("select * from roles where id = (select role_id from role_slugs where slug = $1) and company_id = $2", [p, companyId]));
  if (!role) notFound();
  if (p !== role.slug) redirect(`/roles/${role.slug}${sub}`);
  return role;
}

/** An applicant from the web address: "/applicants/hannah-brooks" (numbers move to the name). */
export async function applicantByParam(param: string, companyId: number) {
  const p = decodeURIComponent(param);
  const found = await db.one<{ id: number; slug: string }>(
    `select a.id, a.slug from applicants a join roles r on r.id = a.role_id where ${isId(p) ? "a.id = $1::int" : "a.slug = $1"} and r.company_id = $2`,
    [p, companyId],
  );
  if (!found) notFound();
  if (p !== found.slug) redirect(`/applicants/${found.slug}`);
  return ownApplicant(found.id, companyId);
}

/** Prep sheet address: "/interviews/hannah-brooks/prep" shows that person's latest interview. */
export async function interviewByParam(param: string, companyId: number) {
  const p = decodeURIComponent(param);
  if (isId(p)) {
    const iv = await ownInterview(Number(p), companyId);
    const a = await db.one<{ slug: string }>("select slug from applicants where id = $1", [iv.applicant_id]);
    redirect(`/interviews/${a!.slug}/prep`);
  }
  const iv = await db.one<{ id: number }>(
    `select i.id from interviews i join applicants a on a.id = i.applicant_id join roles r on r.id = i.role_id
     where a.slug = $1 and r.company_id = $2 order by (i.status = 'cancelled'), i.starts_at desc nulls last, i.id desc limit 1`,
    [p, companyId],
  );
  if (!iv) notFound();
  return ownInterview(iv.id, companyId);
}

export async function ownApplicant(applicantId: number, companyId: number) {
  const a = await db.one<Applicant>(
    "select a.* from applicants a join roles r on r.id = a.role_id where a.id = $1 and r.company_id = $2",
    [applicantId, companyId],
  );
  if (!a) notFound();
  const r = (await db.one<Role>("select * from roles where id = $1", [a.role_id]))!;
  return { a, r };
}

export async function ownInterview(interviewId: number, companyId: number) {
  const iv = await db.one<{ id: number; applicant_id: number; role_id: number; token: string; status: string }>(
    "select i.* from interviews i join roles r on r.id = i.role_id where i.id = $1 and r.company_id = $2",
    [interviewId, companyId],
  );
  if (!iv) notFound();
  return iv;
}
