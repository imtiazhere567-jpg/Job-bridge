"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { hire } from "@/lib/hiring";
import { intakeApplication, rescore, validateCv } from "@/lib/intake";
import { logActivity, send, templates } from "@/lib/messages";
import { ownApplicant, ownInterview, ownRole } from "@/lib/owner";

const ids = (form: FormData) => form.getAll("ids").map(Number).filter(Boolean);

/** Owner approves: shortlist and send each person a booking link. */
export async function shortlist(form: FormData) {
  const { company } = await requireEmployer();
  for (const id of ids(form)) {
    const x = await ownApplicant(id, company.id);
    if (!["applied", "rejected"].includes(x.a.stage) || x.r.status !== "open") continue;
    const token = crypto.randomBytes(18).toString("base64url");
    await db.tx(async (t) => {
      await t.q("insert into interviews (applicant_id, role_id, token) values ($1,$2,$3)", [x.a.id, x.r.id, token]);
      await t.q("update applicants set stage = 'invited', updated_at = now() where id = $1", [x.a.id]);
      const m = templates.invite(x.a, x.r, company, token);
      await send(t, x.a, "invite", m.subject, m.body);
      await logActivity(t, `${x.a.name} shortlisted and invited to book an interview`, x.r.id, x.a.id);
    });
  }
  revalidatePath("/", "layout");
}

/** Owner decides not to continue: send a polite, personal message. */
export async function reject(form: FormData) {
  const { company } = await requireEmployer();
  for (const id of ids(form)) {
    const x = await ownApplicant(id, company.id);
    if (["rejected", "hired"].includes(x.a.stage)) continue;
    const after = ["interviewed", "no_show"].includes(x.a.stage);
    await db.tx(async (t) => {
      await t.q("update applicants set stage = 'rejected', updated_at = now() where id = $1", [x.a.id]);
      await t.q("update interviews set status = 'cancelled' where applicant_id = $1 and status in ('invited','booked')", [x.a.id]);
      const m = templates.rejection(x.a, x.r, company, after);
      await send(t, x.a, "rejection", m.subject, m.body);
      await logActivity(t, `Polite "not selected" message sent to ${x.a.name}`, x.r.id, x.a.id);
    });
  }
  revalidatePath("/", "layout");
}

/** Hire. When hires reach the number of openings, the role closes automatically. */
export async function markHired(id: number) {
  const { company } = await requireEmployer();
  await ownApplicant(id, company.id);
  await hire(id);
  revalidatePath("/", "layout");
}

export async function saveNotes(id: number, form: FormData) {
  const { company } = await requireEmployer();
  await ownApplicant(id, company.id);
  await db.q("update applicants set owner_notes = $2, updated_at = now() where id = $1", [id, String(form.get("notes") ?? "").slice(0, 5000)]);
  revalidatePath("/applicants", "layout");
}

export async function rescoreOne(id: number) {
  const { company } = await requireEmployer();
  await ownApplicant(id, company.id);
  await rescore(id);
  revalidatePath("/applicants", "layout");
}

/** CVs that arrive by email or in person: the owner uploads them here. */
export async function addApplicant(roleId: number, _: unknown, form: FormData) {
  const { company } = await requireEmployer();
  const role = await ownRole(roleId, company.id);
  const file = form.get("cv") as File | null;
  const err = validateCv(file);
  if (err) return { error: err };
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Enter the applicant's name." };
  const res = await intakeApplication({
    role,
    name,
    email: String(form.get("email") ?? "").trim() || null,
    phone: String(form.get("phone") ?? "").trim() || null,
    city: null,
    source: String(form.get("source") ?? "email"),
    answers: [],
    file,
  });
  const made = await db.one<{ slug: string }>("select slug from applicants where id = $1", [res.id]);
  redirect(`/applicants/${made?.slug ?? res.id}`);
}

// ---------- Interviews ----------

export async function markAttended(interviewId: number) {
  const { company } = await requireEmployer();
  const iv = await ownInterview(interviewId, company.id);
  const { a } = await ownApplicant(iv.applicant_id, company.id);
  await db.tx(async (t) => {
    await t.q("update interviews set status = 'completed' where id = $1", [iv.id]);
    await t.q("update applicants set stage = 'interviewed', updated_at = now() where id = $1", [iv.applicant_id]);
    await logActivity(t, `Interview completed with ${a.name}`, iv.role_id, iv.applicant_id);
  });
  revalidatePath("/", "layout");
}

/** One polite follow-up with a link to pick a new time. */
export async function markNoShow(interviewId: number) {
  const { company } = await requireEmployer();
  const iv = await ownInterview(interviewId, company.id);
  const x = await ownApplicant(iv.applicant_id, company.id);
  await db.tx(async (t) => {
    const already = await t.one<{ followup_sent: boolean }>("select followup_sent from interviews where id = $1", [iv.id]);
    await t.q("update interviews set status = 'no_show' where id = $1", [iv.id]);
    await t.q("update applicants set stage = 'no_show', updated_at = now() where id = $1", [iv.applicant_id]);
    if (!already?.followup_sent) {
      const token = crypto.randomBytes(18).toString("base64url");
      await t.q("insert into interviews (applicant_id, role_id, token, followup_sent) values ($1,$2,$3,true)", [iv.applicant_id, iv.role_id, token]);
      await t.q("update interviews set followup_sent = true where id = $1", [iv.id]);
      const m = templates.noShow(x.a, x.r, company, token);
      await send(t, x.a, "no_show", m.subject, m.body);
      await logActivity(t, `${x.a.name} missed the interview; one follow-up sent`, iv.role_id, iv.applicant_id);
    } else {
      await logActivity(t, `${x.a.name} missed the rebooked interview (no more follow-ups)`, iv.role_id, iv.applicant_id);
    }
  });
  revalidatePath("/", "layout");
}
