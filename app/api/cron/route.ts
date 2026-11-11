import { runReminders } from "@/lib/booking";
import { resetDatabase } from "@/lib/db";
import { demoMode, flushOutbox } from "@/lib/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled jobs. Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
 * - always: interview reminders (24h / 2h) and any queued messages
 * - ?reset=1 in demo mode: wipe and re-seed the portfolio demo
 * For reminders more often than once a day (Vercel's free plan limit), point a free
 * scheduler such as cron-job.org at /api/cron with the same header.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const reset = new URL(req.url).searchParams.get("reset") === "1" && demoMode();
  if (reset) await resetDatabase();
  const reminders = await runReminders();
  await flushOutbox();
  return Response.json({ ok: true, reset, reminders });
}
