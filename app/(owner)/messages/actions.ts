"use server";

import { revalidatePath } from "next/cache";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoMode, logActivity, receiveWhatsApp, send } from "@/lib/messages";
import { ownApplicant } from "@/lib/owner";

/** Owner writes to an applicant on WhatsApp. */
export async function ownerReply(applicantId: number, form: FormData) {
  const { company } = await requireEmployer();
  const { a } = await ownApplicant(applicantId, company.id);
  const text = String(form.get("text") ?? "").trim().slice(0, 2000);
  if (!text || !a.phone) return;
  await db.tx(async (t) => {
    await send(t, a, "reply", `Message from ${company.name}`, text, "whatsapp");
    await logActivity(t, `You replied to ${a.name} on WhatsApp`, a.role_id, a.id);
  });
  revalidatePath("/messages");
}

/** Demo only: pretend to be the applicant replying from their phone. */
export async function demoApplicantReply(applicantId: number, form: FormData) {
  const { company } = await requireEmployer();
  await ownApplicant(applicantId, company.id);
  if (!demoMode()) return;
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  if (!text) return;
  await receiveWhatsApp(applicantId, text);
  revalidatePath("/messages");
}
