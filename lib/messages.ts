import "server-only";
import { after } from "next/server";
import { db, type Queryable } from "./db";
import type { Applicant, Company, Role } from "./types";
import { fmtDateTime } from "./format";

/**
 * Applicant messages (WhatsApp + email).
 *
 * Demo mode (default, DEMO_MODE not "off"): every message is stored and shown
 * in the WhatsApp chat screen and outbox, nothing leaves the app.
 * Live mode (DEMO_MODE=off): a channel sends for real as soon as its keys are set:
 *   WhatsApp  WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID (Meta WhatsApp Cloud API)
 *             WHATSAPP_TEMPLATE (+ WHATSAPP_TEMPLATE_LANG) for messages that open a conversation
 *   Email     RESEND_API_KEY + EMAIL_FROM
 * Messages are saved first, then delivered after the response (status: queued → sent / failed).
 */

export type Kind =
  | "received"
  | "invite"
  | "booked"
  | "reminder_24"
  | "reminder_2"
  | "rescheduled"
  | "no_show"
  | "rejection"
  | "hired"
  | "cancelled"
  | "reply"
  | "auto_reply";

export const demoMode = () => process.env.DEMO_MODE !== "off";
const whatsappReady = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
const emailReady = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
export const channelLive = (channel: string) => !demoMode() && (channel === "whatsapp" ? whatsappReady() : emailReady());

/** 07xxx xxxxxx → 447xxxxxxxxx (WhatsApp wants international digits only). */
export const waNumber = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.startsWith("0") ? `44${d.slice(1)}` : d;
};

async function deliverWhatsApp(to: string, body: string, kind: string) {
  const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const template = process.env.WHATSAPP_TEMPLATE;
  // Replies inside the 24-hour customer window can be free text; anything that
  // opens a conversation must use an approved template with the text as {{1}}.
  const payload =
    template && kind !== "reply" && kind !== "auto_reply"
      ? {
          messaging_product: "whatsapp",
          to: waNumber(to),
          type: "template",
          template: {
            name: template,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" },
            components: [{ type: "body", parameters: [{ type: "text", text: body.replace(/\s*\n+\s*/g, " · ").replace(/ {4,}/g, " ").slice(0, 1000) }] }],
          },
        }
      : { messaging_product: "whatsapp", to: waNumber(to), type: "text", text: { body: body.slice(0, 4096) } };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function deliverEmail(to: string, subject: string, body: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text: body }),
  });
  if (!res.ok) throw new Error(`Email ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Deliver every queued message. Safe to call more than once: rows are claimed before sending. */
export async function flushOutbox() {
  const batch = await db.q<{ id: number; channel: string; to_addr: string; subject: string; body: string; kind: string }>(
    `update messages set status = 'sending' where id in (select id from messages where status = 'queued' order by id limit 50)
     returning id, channel, to_addr, subject, body, kind`,
  );
  for (const m of batch) {
    try {
      if (m.channel === "whatsapp") await deliverWhatsApp(m.to_addr, m.body, m.kind);
      else await deliverEmail(m.to_addr, m.subject, m.body);
      await db.q("update messages set status = 'sent', error = null where id = $1", [m.id]);
    } catch (e) {
      await db.q("update messages set status = 'failed', error = $2 where id = $1", [m.id, String((e as Error).message ?? e).slice(0, 500)]);
    }
  }
}

function scheduleFlush() {
  try {
    after(flushOutbox); // after the response is sent (Vercel keeps the function alive for it)
  } catch {
    setTimeout(() => flushOutbox().catch((e) => console.error("[outbox]", e)), 0); // outside a request (local timer)
  }
}

/** Store a message on each channel we have for the applicant, and queue it if that channel is live. */
export async function send(
  t: Queryable,
  a: Pick<Applicant, "id" | "name" | "email" | "phone">,
  kind: Kind,
  subject: string,
  body: string,
  only?: "whatsapp" | "email",
) {
  const channels: [string, string | null][] = [];
  if (a.phone && only !== "email") channels.push(["whatsapp", a.phone]);
  if (a.email && only !== "whatsapp") channels.push(["email", a.email]);
  if (!channels.length) channels.push([only ?? "email", null]);
  let queued = false;
  for (const [channel, to] of channels) {
    const text = channel === "whatsapp" ? body.replace(/\n\n+/g, "\n\n") : body;
    const status = to && channelLive(channel) ? "queued" : "demo";
    queued ||= status === "queued";
    await t.q("insert into messages (applicant_id, channel, to_addr, kind, subject, body, status) values ($1,$2,$3,$4,$5,$6,$7)", [a.id, channel, to, kind, subject, text, status]);
  }
  if (queued) scheduleFlush();
}

/** A WhatsApp message from the applicant (real webhook, or "reply as applicant" in the demo). */
export async function receiveWhatsApp(applicantId: number, text: string) {
  const a = await db.one<Applicant>("select id, name, email, phone, role_id from applicants where id = $1", [applicantId]);
  if (!a) return;
  await db.tx(async (t) => {
    await t.q("insert into messages (applicant_id, channel, to_addr, kind, subject, body, direction, status) values ($1,'whatsapp',$2,'inbound','',$3,'in','received')", [a.id, a.phone, text]);
    await logActivity(t, `WhatsApp from ${a.name}: "${text.slice(0, 60)}"`, a.role_id, a.id);
    // Helpful auto-reply: asking to change the time gets their booking link straight away.
    if (/(reschedul|change|another time|different time|new time|time change|can'?t come|cannot come)/i.test(text)) {
      const iv = await t.one<{ token: string }>("select token from interviews where applicant_id = $1 and status in ('invited','booked') order by id desc limit 1", [a.id]);
      if (iv) {
        const body = `No problem, ${a.name.split(" ")[0]}! You can pick a new interview time here:\n${baseUrl()}/book/${iv.token}`;
        await send(t, a, "auto_reply", "New time", body, "whatsapp");
      }
    }
  });
}

export const baseUrl = () =>
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:4920");

const first = (name: string) => name.trim().split(/\s+/)[0];

export const templates = {
  received: (a: Applicant, r: Role, c: Company) => ({
    subject: `We received your application – ${r.title}`,
    body: `Hi ${first(a.name)},\n\nThank you for applying for the ${r.title} role at ${c.name}. We have received your application and CV.\n\nWe read every application carefully. If you are shortlisted, we will send you a link to choose an interview time.\n\nWarm regards,\n${c.sign_as ?? c.name}\n${c.name}`,
  }),
  invite: (a: Applicant, r: Role, c: Company, token: string) => ({
    subject: `Interview invitation – ${r.title} at ${c.name}`,
    body: `Hi ${first(a.name)},\n\nGood news! We would like to meet you for the ${r.title} role at ${c.name}.\n\nPlease choose an interview time that suits you here:\n${baseUrl()}/book/${token}\n\nThe interview takes about ${c.slot_minutes} minutes at ${c.interview_location ?? c.address}.\n\nSee you soon,\n${c.sign_as ?? c.name}`,
  }),
  booked: (a: Applicant, r: Role, c: Company, when: Date, token: string) => ({
    subject: `Interview confirmed – ${fmtDateTime(when)}`,
    body: `Hi ${first(a.name)},\n\nYour interview for ${r.title} is confirmed:\n\n${fmtDateTime(when)}\n${c.interview_location ?? c.address}\n\nPlease bring a copy of your CV and a photo ID (passport or driving licence). Need to change the time? Use this link:\n${baseUrl()}/book/${token}\n\n${c.name}`,
  }),
  reminder: (a: Applicant, r: Role, c: Company, when: Date, token: string, hours: 24 | 2) => ({
    subject: hours === 24 ? `Reminder: your interview is tomorrow` : `Reminder: your interview is in 2 hours`,
    body: `Hi ${first(a.name)},\n\nA quick reminder that your interview for ${r.title} at ${c.name} is ${hours === 24 ? "tomorrow" : "in about 2 hours"}:\n\n${fmtDateTime(when)}\n${c.interview_location ?? c.address}\n\nCan't make it? Pick a new time here: ${baseUrl()}/book/${token}\n\n${c.name}`,
  }),
  noShow: (a: Applicant, r: Role, c: Company, token: string) => ({
    subject: `We missed you today`,
    body: `Hi ${first(a.name)},\n\nWe were expecting you for your ${r.title} interview at ${c.name}, but it looks like you couldn't make it. We hope everything is okay.\n\nIf you are still interested, you can choose a new time here:\n${baseUrl()}/book/${token}\n\nKind regards,\n${c.name}`,
  }),
  hired: (a: Applicant, r: Role, c: Company) => ({
    subject: `Congratulations – you got the ${r.title} job!`,
    body: `Hi ${first(a.name)},\n\nCongratulations! We are happy to offer you the ${r.title} role at ${c.name}.\n\nWe will contact you shortly with your offer letter and first-day details${r.start_date ? ` (planned start: ${r.start_date})` : ""}.\n\nWelcome to the team,\n${c.sign_as ?? c.name}`,
  }),
  rejection: (a: Applicant, r: Role, c: Company, afterInterview: boolean) => ({
    subject: `Your application for ${r.title}`,
    body: afterInterview
      ? `Hi ${first(a.name)},\n\nThank you for taking the time to meet us for the ${r.title} role. We enjoyed speaking with you.\n\nAfter a lot of thought, we have decided to move forward with another candidate. This was a close decision, and we would be happy to contact you again when a suitable role opens at ${c.name}.\n\nWe wish you every success,\n${c.sign_as ?? c.name}`
      : `Hi ${first(a.name)},\n\nThank you for your interest in the ${r.title} role at ${c.name} and for the time you spent applying.\n\nWe received many strong applications, and this time we have decided to continue with candidates whose experience is a closer match for this role. We will keep your details and may contact you about future openings.\n\nWe wish you the very best,\n${c.sign_as ?? c.name}`,
  }),
};

/** Activity feed entry. The company is taken from the role unless given. */
export async function logActivity(t: Queryable, text: string, roleId?: number | null, applicantId?: number | null, companyId?: number | null) {
  await t.q(
    "insert into activity (company_id, role_id, applicant_id, text) values (coalesce($4::int, (select company_id from roles where id = $1::int)), $1, $2, $3)",
    [roleId ?? null, applicantId ?? null, text, companyId ?? null],
  );
}

/** Company columns without the logo bytes. */
export const COMPANY_COLS =
  "id, owner_id, slug, name, industry, size, tagline, about, address, city, phone, email, website, sign_as, tone, brand_color, accent_color, logo_type, slot_minutes, interview_location, created_at";

export async function getCompany(id: number, t: Queryable = db) {
  return (await t.one<Company>(`select ${COMPANY_COLS} from companies where id = $1`, [id]))!;
}

export async function companyForRole(roleId: number, t: Queryable = db) {
  return (await t.one<Company>(`select ${COMPANY_COLS} from companies where id = (select company_id from roles where id = $1)`, [roleId]))!;
}
