import "server-only";
import { db } from "./db";
import { dayKey, zoned } from "./format";
import { companyForRole, getCompany, logActivity, send, templates } from "./messages";
import type { Applicant, Role } from "./types";

export interface Slot {
  start: Date;
  end: Date;
}

const DAYS_AHEAD = 14;

/** A company's free interview slots from its weekly availability, minus booked interviews. */
export async function freeSlots(companyId: number, excludeInterviewId?: number): Promise<Slot[]> {
  const company = await getCompany(companyId);
  const rules = await db.q<{ weekday: number; start_time: string; end_time: string }>(
    "select weekday, start_time, end_time from availability where company_id = $1 order by weekday, start_time",
    [companyId],
  );
  const booked = await db.q<{ starts_at: string; ends_at: string }>(
    `select i.starts_at, i.ends_at from interviews i join roles r on r.id = i.role_id
     where r.company_id = $1 and i.status = 'booked' and i.starts_at > now() and i.id <> $2`,
    [companyId, excludeInterviewId ?? 0],
  );
  const taken = booked.map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()]);
  const minStart = Date.now() + 3 * 3600_000; // at least 3 hours' notice
  const out: Slot[] = [];
  const step = company.slot_minutes * 60_000;

  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const day = dayKey(new Date(Date.now() + i * 86400_000));
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    for (const r of rules.filter((x) => x.weekday === weekday)) {
      let t = zoned(day, r.start_time).getTime();
      const end = zoned(day, r.end_time).getTime();
      for (; t + step <= end; t += step) {
        if (t < minStart) continue;
        if (taken.some(([s, e]) => t < e && t + step > s)) continue;
        out.push({ start: new Date(t), end: new Date(t + step) });
      }
    }
  }
  return out;
}

/** Interview reminders (24h and 2h before) for every company. Safe to call often. */
export async function runReminders() {
  const due = await db.q<{ id: number; token: string; starts_at: string; reminder_24_sent: boolean; reminder_2_sent: boolean; applicant_id: number; role_id: number }>(
    `select id, token, starts_at, reminder_24_sent, reminder_2_sent, applicant_id, role_id from interviews
     where status = 'booked' and starts_at > now() and starts_at <= now() + interval '24 hours'
       and (not reminder_24_sent or (not reminder_2_sent and starts_at <= now() + interval '2 hours'))`,
  );
  for (const iv of due) {
    const a = (await db.one<Applicant>("select * from applicants where id = $1", [iv.applicant_id]))!;
    const r = (await db.one<Role>("select * from roles where id = $1", [iv.role_id]))!;
    const company = await companyForRole(r.id);
    const when = new Date(iv.starts_at);
    const within2h = when.getTime() - Date.now() <= 2 * 3600_000;
    await db.tx(async (t) => {
      if (within2h && !iv.reminder_2_sent) {
        const m = templates.reminder(a, r, company, when, iv.token, 2);
        await send(t, a, "reminder_2", m.subject, m.body);
        await t.q("update interviews set reminder_2_sent = true, reminder_24_sent = true where id = $1", [iv.id]);
      } else if (!iv.reminder_24_sent) {
        const m = templates.reminder(a, r, company, when, iv.token, 24);
        await send(t, a, "reminder_24", m.subject, m.body);
        await t.q("update interviews set reminder_24_sent = true where id = $1", [iv.id]);
      }
      await logActivity(t, `Reminder sent to ${a.name} for interview ${within2h ? "in 2 hours" : "tomorrow"}`, r.id, a.id);
    });
  }
  return due.length;
}
