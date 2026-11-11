import Link from "next/link";
import { Bell, CalendarClock, Check, ClipboardList, Clock3, Settings2 } from "lucide-react";
import { Submit } from "@/components/client";
import { Avatar, Empty, HeroHeader, WhatsAppLink } from "@/components/ui";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { ago, dayKey, fmtDay, fmtTime } from "@/lib/format";
import { markAttended, markNoShow } from "../applicants/actions";

export const metadata = { title: "Interviews" };

type Iv = { id: number; slug: string; status: string; starts_at: string | null; created_at: string; applicant_id: number; name: string; phone: string | null; title: string; score: number | null; reminder_24_sent: boolean; reminder_2_sent: boolean };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TZ = "Europe/London";
const t12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export default async function Interviews() {
  const { company } = await requireEmployer();
  const all = await db.q<Iv>(
    `select i.id, i.status, i.starts_at, i.created_at, i.reminder_24_sent, i.reminder_2_sent, a.id as applicant_id, a.slug, a.name, a.phone, a.score, r.title
     from interviews i join applicants a on a.id = i.applicant_id join roles r on r.id = i.role_id where r.company_id = $1 order by i.starts_at nulls last, i.created_at desc`,
    [company.id],
  );
  const avail = await db.q<{ weekday: number; start_time: string; end_time: string }>("select weekday, start_time, end_time from availability where company_id = $1 order by weekday", [company.id]);
  const now = Date.now();
  const upcoming = all.filter((i) => i.status === "booked" && new Date(i.starts_at!).getTime() > now - 3600_000);
  const toMark = all.filter((i) => i.status === "booked" && new Date(i.starts_at!).getTime() <= now - 3600_000);
  const waiting = all.filter((i) => i.status === "invited");
  const done = all.filter((i) => ["completed", "no_show"].includes(i.status)).slice(-12).reverse();
  const next24 = upcoming.filter((i) => new Date(i.starts_at!).getTime() < now + 86_400_000).length;
  const attended = all.filter((i) => i.status === "completed").length;

  const byDay = new Map<string, Iv[]>();
  for (const i of upcoming) {
    const k = dayKey(new Date(i.starts_at!));
    byDay.set(k, [...(byDay.get(k) ?? []), i]);
  }

  return (
    <>
      <HeroHeader
        eyebrow="Interviews"
        title="Interview schedule"
        sub="Candidates book themselves from your free times. Reminders go out 24 hours and 2 hours before."
        stats={[
          { label: "Upcoming", value: upcoming.length },
          { label: "In the next 24 hours", value: next24, tone: "sky" },
          { label: "Waiting to book", value: waiting.length, tone: "amber" },
          { label: "Attended", value: attended, tone: "green" },
        ]}
      >
        <Link href="/settings#availability" className="btn bg-white text-lagoon hover:bg-mint">
          <Settings2 size={15} /> Edit free times
        </Link>
      </HeroHeader>

      {toMark.length > 0 && (
        <section className="card mb-6 border-amber/30 bg-amber-soft/50 p-5">
          <h2 className="font-display text-lg font-extrabold text-amber">Did they come? ({toMark.length})</h2>
          <p className="text-[13px] text-slate">Mark each past interview so the system knows what to send next.</p>
          <div className="mt-3 space-y-2">
            {toMark.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-shell bg-white p-3">
                <Avatar name={i.name} size={36} />
                <div className="min-w-0 flex-1">
                  <Link href={`/applicants/${i.slug}?from=interviews`} className="font-bold text-ink hover:text-coral">{i.name}</Link>
                  <div className="text-[12.5px] text-slate">{i.title} · {fmtDay(i.starts_at!)}, {fmtTime(i.starts_at!)}</div>
                </div>
                <form action={markAttended.bind(null, i.id)}><Submit className="btn btn-primary py-1.5">Attended</Submit></form>
                <form action={markNoShow.bind(null, i.id)}><Submit className="btn btn-ghost py-1.5" confirm="Mark as no-show? One polite follow-up with a rebooking link will be sent.">No-show</Submit></form>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="space-y-6">
          {byDay.size === 0 && <Empty title="No interviews booked">Shortlist applicants and they&apos;ll receive a link to book a time.</Empty>}
          {[...byDay.entries()].map(([k, list]) => {
            const d = new Date(list[0].starts_at!);
            return (
              <div key={k} className="flex gap-4">
                <div className="flex w-16 shrink-0 flex-col items-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-lagoon text-center leading-none text-white">
                    <div>
                      <div className="text-[10.5px] font-bold tracking-wider text-[#5db6f7] uppercase">{d.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short" })}</div>
                      <div className="mt-1 font-display text-[24px] font-extrabold">{d.toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric" })}</div>
                      <div className="mt-0.5 text-[10px] font-bold tracking-wider text-white/60 uppercase">{d.toLocaleDateString("en-GB", { timeZone: TZ, month: "short" })}</div>
                    </div>
                  </div>
                  <div className="mt-2 w-px flex-1 bg-shell" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="pt-1 font-display text-[15px] font-extrabold text-lagoon">{fmtDay(list[0].starts_at!)}</div>
                  {list.map((i) => (
                    <div key={i.id} className="card flex flex-wrap items-center gap-4 p-4">
                      <div className="flex shrink-0 flex-col">
                        <span className="flex items-center gap-1.5 font-display text-[18px] font-extrabold whitespace-nowrap text-lagoon"><Clock3 size={15} className="text-coral" />{fmtTime(i.starts_at!)}</span>
                        <span className="text-[11.5px] text-slate">{company.slot_minutes} min</span>
                      </div>
                      <Avatar name={i.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/applicants/${i.slug}?from=interviews`} className="font-bold text-ink hover:text-coral">{i.name}</Link>
                        <div className="text-[12.5px] text-slate">{i.title}{i.score != null ? ` · score ${i.score}` : ""}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Reminder label="24h reminder" sent={i.reminder_24_sent} />
                          <Reminder label="2h reminder" sent={i.reminder_2_sent} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <WhatsAppLink phone={i.phone} text={`Hi ${i.name.split(" ")[0]}, this is JobBridge about your interview.`} compact />
                        <Link href={`/interviews/${i.slug}/prep?from=interviews`} className="btn btn-ghost py-1.5 text-[13px]"><ClipboardList size={14} /> Prep sheet</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <aside className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-ink">Waiting to book</h2>
              <span className="chip bg-amber-soft text-amber">{waiting.length}</span>
            </div>
            <p className="mt-1 text-[12.5px] text-slate">They have a booking link but haven&apos;t picked a time yet.</p>
            <ul className="mt-4 space-y-2.5">
              {waiting.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl border border-shell p-2.5">
                  <Avatar name={i.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/applicants/${i.slug}?from=interviews`} className="block truncate text-sm font-bold text-ink hover:text-coral">{i.name}</Link>
                    <span className="text-[12px] text-slate">invited {ago(i.created_at)}</span>
                  </div>
                  <WhatsAppLink phone={i.phone} text={`Hi ${i.name.split(" ")[0]}, a reminder from JobBridge to pick your interview time using the link we sent.`} compact />
                </li>
              ))}
              {waiting.length === 0 && <li className="rounded-xl bg-pearl p-3 text-sm text-slate">Nobody waiting.</li>}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="font-display text-lg font-extrabold text-ink">Recent</h2>
            <ul className="mt-4 space-y-2.5">
              {done.map((i) => (
                <li key={i.id} className="flex items-center gap-3">
                  <Avatar name={i.name} size={32} />
                  <Link href={`/applicants/${i.slug}?from=interviews`} className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-coral">{i.name}</Link>
                  <span className={`chip ${i.status === "no_show" ? "bg-rust-soft text-rust" : "bg-[#E3F4EC] text-seafoam-dark"}`}>
                    {i.status === "no_show" ? "No-show" : <><Check size={12} /> Attended</>}
                  </span>
                </li>
              ))}
              {done.length === 0 && <li className="rounded-xl bg-pearl p-3 text-sm text-slate">No past interviews yet.</li>}
            </ul>
          </div>

          <div className="bridge-gradient rounded-[18px] p-6 text-white">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><CalendarClock size={18} className="text-[#5db6f7]" /> Your free times</h2>
              <Link href="/settings#availability" className="text-[12.5px] font-semibold text-[#5db6f7] hover:underline">Edit</Link>
            </div>
            <ul className="mt-4 space-y-1.5 text-[13.5px]">
              {avail.map((a) => (
                <li key={a.weekday} className="flex justify-between border-b border-white/10 pb-1.5 last:border-0">
                  <span className="font-semibold">{DAYS[a.weekday]}</span>
                  <span className="text-white/75">{t12(a.start_time)} – {t12(a.end_time)}</span>
                </li>
              ))}
              {avail.length === 0 && <li className="text-white/70">No free times set yet.</li>}
            </ul>
            <p className="mt-4 flex items-center gap-2 text-[12px] text-white/65"><Bell size={13} /> Reminders are sent automatically.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function Reminder({ label, sent }: { label: string; sent: boolean }) {
  return (
    <span className={`chip px-2 py-0.5 text-[11px] ${sent ? "bg-[#E3F4EC] text-seafoam-dark" : "bg-pearl text-slate border border-shell"}`}>
      {sent ? <Check size={11} /> : <Clock3 size={11} />} {label} {sent ? "sent" : "pending"}
    </span>
  );
}
