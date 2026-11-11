import { Bot, Building2, CalendarClock, Clock3, Mail, MapPin, MessageSquareText, Sparkles } from "lucide-react";
import { aiEnabled } from "@/lib/ai";
import { Submit } from "@/components/client";
import { HeroHeader } from "@/components/ui";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Company } from "@/lib/types";
import { saveAvailability, saveBusiness } from "./actions";

export const metadata = { title: "Settings" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function Settings() {
  const { company } = await requireEmployer();
  const avail = await db.q<{ weekday: number; start_time: string; end_time: string }>("select * from availability where company_id = $1", [company.id]);
  const field = (k: keyof Company, label: string, placeholder = "", wide = false, type = "text") => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      <input name={k} type={type} defaultValue={(company[k] as string | null) ?? ""} placeholder={placeholder} className="field" />
    </div>
  );
  const ai = aiEnabled();
  return (
    <>
      <HeroHeader
        eyebrow="Settings"
        title="Business settings"
        sub="These details appear in job posts, posters, the apply form and every WhatsApp and email message to applicants."
        stats={[
          { label: "Interview days", value: avail.length, tone: "sky" },
          { label: "Interview length", value: `${company.slot_minutes} min` },
          { label: "AI writing", value: ai ? "On" : "Templates", tone: ai ? "green" : "amber" },
          { label: "City", value: company.city ?? "–" },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <form action={saveBusiness} className="card overflow-hidden">
          <Section icon={<Building2 size={16} />} title="Business" note="How your business is named and described.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("name", "Business name")}
              {field("sign_as", "Sign messages as", "The JobBridge Team")}
              {field("tagline", "Tagline", "Connecting talent to opportunity", true)}
              <div className="sm:col-span-2">
                <label className="label">About <span className="font-normal text-slate">(shown in job posts)</span></label>
                <textarea name="about" rows={3} defaultValue={company.about ?? ""} className="field" />
              </div>
            </div>
          </Section>

          <Section icon={<Mail size={16} />} title="Contact details" note="Shown on posters and in messages so applicants can reach you.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("address", "Address", "", true)}
              {field("city", "City")}
              {field("phone", "Phone", "020 7946 0000", false, "tel")}
              {field("email", "Careers email", "careers@yourcompany.com", false, "email")}
              {field("website", "Website", "https://")}
            </div>
          </Section>

          <Section icon={<MapPin size={16} />} title="Interviews" note="Sent to candidates when they book a time.">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
              {field("interview_location", "Where interviews happen")}
              <div>
                <label className="label">Length (minutes)</label>
                <input name="slot_minutes" type="number" min={15} max={120} step={5} defaultValue={company.slot_minutes} className="field" />
              </div>
            </div>
          </Section>

          <Section icon={<MessageSquareText size={16} />} title="Writing tone" note="How the assistant writes job posts, captions and poster text.">
            <input name="tone" defaultValue={company.tone ?? ""} placeholder="friendly, clear and confident" className="field" />
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-slate">
              Examples: <span className="chip bg-pearl">friendly and warm</span><span className="chip bg-pearl">professional and formal</span><span className="chip bg-pearl">short and energetic</span>
            </div>
          </Section>

          <div className="flex items-center justify-between gap-3 border-t border-shell bg-pearl/60 px-6 py-4">
            <span className="text-[12.5px] text-slate">Changes apply to new posts and messages straight away.</span>
            <Submit pendingText="Saving…">Save settings</Submit>
          </div>
        </form>

        <div className="space-y-6">
          <form id="availability" action={saveAvailability} className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-shell px-6 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-coral"><CalendarClock size={17} /></span>
              <div>
                <h2 className="font-display text-[17px] font-extrabold text-lagoon">Free times for interviews</h2>
                <p className="text-[12.5px] text-slate">Candidates only see these times, minus anything already booked.</p>
              </div>
            </div>
            <ul className="divide-y divide-shell">
              {DAYS.map((d, wd) => {
                const a = avail.find((x) => x.weekday === wd);
                return (
                  <li key={wd} className="flex flex-wrap items-center gap-3 px-6 py-3">
                    <label className="flex w-32 cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-ink">
                      <input type="checkbox" name={`on${wd}`} defaultChecked={!!a} className="h-4 w-4 accent-coral" /> {d}
                    </label>
                    <div className="ml-auto flex items-center gap-2">
                      <input type="time" name={`s${wd}`} defaultValue={a?.start_time ?? "11:00"} className="field w-auto py-1.5 text-[13px]" aria-label={`${d} start`} />
                      <span className="text-slate">–</span>
                      <input type="time" name={`e${wd}`} defaultValue={a?.end_time ?? "13:00"} className="field w-auto py-1.5 text-[13px]" aria-label={`${d} end`} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-shell bg-pearl/60 px-6 py-4">
              <span className="flex items-center gap-1.5 text-[12.5px] text-slate"><Clock3 size={13} /> Tick a day to make it available.</span>
              <Submit pendingText="Saving…">Save free times</Submit>
            </div>
          </form>

          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-shell px-6 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-coral"><Bot size={17} /></span>
              <h2 className="font-display text-[17px] font-extrabold text-lagoon">AI assistant</h2>
              <span className={`chip ml-auto ${ai ? "bg-[#E3F4EC] text-seafoam-dark" : "bg-amber-soft text-amber"}`}>{ai ? "Connected" : "Template mode"}</span>
            </div>
            <div className="p-6 text-[13.5px] leading-relaxed text-slate">
              {ai ? (
                <p className="flex gap-2"><Sparkles size={15} className="mt-0.5 shrink-0 text-coral" /> Claude writes your job posts, captions and poster text, and reads every CV.</p>
              ) : (
                <p>Job posts use built-in templates and CVs are scored by the rules engine. Add <code className="rounded bg-pearl px-1.5 py-0.5 text-[12px] text-lagoon">ANTHROPIC_API_KEY</code> to switch on Claude.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ icon, title, note, children }: { icon: React.ReactNode; title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-shell px-6 py-6 last-of-type:border-b-0">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint text-coral">{icon}</span>
        <div>
          <h2 className="font-display text-[17px] font-extrabold text-lagoon">{title}</h2>
          <p className="text-[12.5px] text-slate">{note}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
