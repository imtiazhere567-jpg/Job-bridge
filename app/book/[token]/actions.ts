"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { freeSlots } from "@/lib/booking";
import { companyForRole, logActivity, send, templates } from "@/lib/messages";
import type { Applicant, Role } from "@/lib/types";

async function byToken(token: string) {
  return db.one<{ id: number; applicant_id: number; role_id: number; status: string; starts_at: string | null }>(
    "select id, applicant_id, role_id, status, starts_at from interviews where token = $1",
    [token],
  );
}

export async function book(token: string, _: unknown, form: FormData) {
  const iv = await byToken(token);
  if (!iv || !["invited", "booked"].includes(iv.status)) return { error: "This booking link is no longer active." };
  const open = await db.one("select 1 from roles where id = $1 and status = 'open'", [iv.role_id]);
  if (!open) return { error: "Sorry, this position has been filled, so interviews are no longer being booked." };
  const start = new Date(String(form.get("slot") ?? ""));
  if (isNaN(start.getTime())) return { error: "Please choose a time." };
  // Re-check against live availability so two people can't take the same slot.
  const slot = (await freeSlots((await companyForRole(iv.role_id)).id, iv.id)).find((s) => s.start.getTime() === start.getTime());
  if (!slot) return { error: "Sorry, that time was just taken. Please choose another." };

  const company = await companyForRole(iv.role_id);
  const a = (await db.one<Applicant>("select * from applicants where id = $1", [iv.applicant_id]))!;
  const r = (await db.one<Role>("select * from roles where id = $1", [iv.role_id]))!;
  const rescheduled = iv.status === "booked";
  await db.tx(async (t) => {
    await t.q("update interviews set status = 'booked', starts_at = $2, ends_at = $3, reminder_24_sent = false, reminder_2_sent = false where id = $1", [iv.id, slot.start, slot.end]);
    await t.q("update applicants set stage = 'booked', updated_at = now() where id = $1", [a.id]);
    const m = templates.booked(a, r, company, slot.start, token);
    await send(t, a, rescheduled ? "rescheduled" : "booked", rescheduled ? `Interview moved – ${m.subject.split("– ")[1]}` : m.subject, m.body);
    await logActivity(t, `${a.name} ${rescheduled ? "rescheduled" : "booked"} an interview`, r.id, a.id);
  });
  revalidatePath(`/book/${token}`);
  return { error: "" };
}

export async function cancelBooking(token: string) {
  const iv = await byToken(token);
  if (!iv || iv.status !== "booked") return;
  const a = (await db.one<Applicant>("select * from applicants where id = $1", [iv.applicant_id]))!;
  await db.tx(async (t) => {
    await t.q("update interviews set status = 'invited', starts_at = null, ends_at = null where id = $1", [iv.id]);
    await t.q("update applicants set stage = 'invited', updated_at = now() where id = $1", [a.id]);
    await logActivity(t, `${a.name} cancelled their interview time (can rebook with the same link)`, iv.role_id, a.id);
  });
  revalidatePath(`/book/${token}`);
}
