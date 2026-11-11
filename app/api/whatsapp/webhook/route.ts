import crypto from "node:crypto";
import { db } from "@/lib/db";
import { receiveWhatsApp } from "@/lib/messages";

/**
 * WhatsApp Cloud API webhook (live mode).
 * In Meta's app dashboard set the callback URL to <site>/api/whatsapp/webhook,
 * the verify token to WHATSAPP_VERIFY_TOKEN, and subscribe to "messages".
 */

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) return new Response(p.get("hub.challenge") ?? "");
  return new Response("Forbidden", { status: 403 });
}

function validSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const given = header.slice(7);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

type Incoming = { from: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string } } };

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Bad signature", { status: 401 });
  const payload = JSON.parse(raw) as { entry?: { changes?: { value?: { messages?: Incoming[] } }[] }[] };
  for (const entry of payload.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? `[${m.type} message]`;
        const local = m.from.startsWith("44") ? `0${m.from.slice(2)}` : m.from;
        // Their most recent application with this number.
        const a = await db.one<{ id: number }>("select id from applicants where phone = $1 or phone = $2 order by id desc limit 1", [local, m.from]);
        if (a) await receiveWhatsApp(a.id, text);
      }
  return new Response("ok"); // Always 200 so Meta doesn't retry.
}
