import { notFound } from "next/navigation";
import { CalendarCheck2, MapPin } from "lucide-react";
import { Logo } from "@/components/logo";
import { Submit } from "@/components/client";
import { db } from "@/lib/db";
import { freeSlots } from "@/lib/booking";
import { dayKey, fmtDateTime, fmtDay, fmtTime } from "@/lib/format";
import { companyForRole } from "@/lib/messages";
import { book, cancelBooking } from "./actions";
import { SlotPicker } from "./picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book your interview", robots: { index: false } };

export default async function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const iv = await db.one<{ id: number; role_id: number; status: string; starts_at: string | null; name: string; title: string; role_status: string }>(
    `select i.id, i.role_id, i.status, i.starts_at, a.name, r.title, r.status as role_status from interviews i join applicants a on a.id = i.applicant_id join roles r on r.id = i.role_id where i.token = $1`,
    [token],
  );
  if (!iv) notFound();
  const clinic = await companyForRole(iv.role_id);
  const filled = iv.role_status !== "open";
  const active = !filled && (iv.status === "invited" || iv.status === "booked");
  const current = iv.starts_at ? new Date(iv.starts_at).getTime() : null;
  const slots = active ? (await freeSlots(clinic.id, iv.id)).filter((s) => s.start.getTime() !== current) : [];
  const days: { day: string; slots: { iso: string; time: string }[] }[] = [];
  for (const s of slots) {
    const key = dayKey(s.start);
    let d = days.find((x) => x.day === key);
    if (!d) days.push((d = { day: key, slots: [] }));
    d.slots.push({ iso: s.start.toISOString(), time: fmtTime(s.start) });
  }
  const labelled = days.map((d) => ({ ...d, day: fmtDay(d.slots[0].iso) }));

  const page = (
    <div className="min-h-screen bg-pearl">
      <header className="border-b border-shell bg-white"><div className="mx-auto max-w-2xl px-4 py-4"><div className="flex items-center justify-between gap-3"><Logo size={40} /><span className="chip bg-mint text-lagoon">Interview booking</span></div></div></header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="eyebrow !text-coral">{iv.title}</div>
        <h1 className="mt-2 font-display text-[32px] leading-tight font-semibold text-lagoon">
          {filled ? `This position has been filled` : iv.status === "booked" ? `You're booked in, ${iv.name.split(" ")[0]}` : `Choose your interview time, ${iv.name.split(" ")[0]}`}
        </h1>
        <p className="mt-2 flex items-start gap-2 text-[15px] text-slate"><MapPin size={16} className="mt-0.5 shrink-0" /> {clinic.interview_location ?? clinic.address} · about {clinic.slot_minutes} minutes</p>

        {!filled && iv.status === "booked" && iv.starts_at && (
          <div className="mt-6 flex items-center gap-4 rounded-[14px] bg-lagoon p-5 text-pearl">
            <CalendarCheck2 size={28} className="text-seafoam" />
            <div className="flex-1">
              <div className="font-display text-xl font-semibold">{fmtDateTime(iv.starts_at)}</div>
              <div className="text-[13px] text-pearl/75">We'll remind you 24 hours and 2 hours before. Please bring your CV and a photo ID (passport or driving licence).</div>
            </div>
            <form action={cancelBooking.bind(null, token)}>
              <Submit className="btn border border-white/25 bg-transparent text-pearl hover:bg-white/10" confirm="Cancel this interview time? You can pick a new one with this same link.">Cancel</Submit>
            </form>
          </div>
        )}

        {!active ? (
          <div className="mt-8 card p-6 text-sm text-slate">{filled ? `Thank you for your interest. This position at ${clinic.name} has now been filled, so interviews are no longer being booked. Keep an eye on the job board for new openings.` : `This booking link is no longer active. If you think this is a mistake, please contact ${clinic.name} on ${clinic.phone}.`}</div>
        ) : iv.status === "booked" ? (
          // Already booked: nothing more to do. Other times stay tucked away until they ask to change.
          <details className="group mt-6 card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-display text-[16px] font-semibold text-ink">Can&apos;t make this time?</span>
                <span className="block text-[13px] text-slate">You can move your interview to another free time.</span>
              </span>
              <span className="btn btn-ghost shrink-0 px-4 py-2 text-[13px] group-open:hidden">Change time</span>
              <span className="btn btn-ghost hidden shrink-0 px-4 py-2 text-[13px] group-open:inline-flex">Keep my time</span>
            </summary>
            <div className="border-t border-shell p-6">
              <SlotPicker key={iv.starts_at ?? "open"} action={book.bind(null, token)} days={labelled} label="Move to" />
            </div>
          </details>
        ) : (
          <div className="mt-8 card p-6">
            <h2 className="mb-5 font-display text-lg font-semibold text-ink">Free times</h2>
            <SlotPicker key={iv.starts_at ?? "open"} action={book.bind(null, token)} days={labelled} label="Book" />
          </div>
        )}
      </main>
    </div>
  );
  return page;
}
