"use client";

import { useActionState, useState } from "react";
import { Briefcase, Building2, CalendarDays, Check, FileText, Home, Laptop, MapPin, MessageSquareText, Palette, Share2, Sparkles, Users, Wallet } from "lucide-react";
import { DescriptionField, JobAssistant } from "@/components/job-assistant";
import { CURRENCY } from "@/lib/jobpost";
import type { Role } from "@/lib/types";

type Action = (state: unknown, form: FormData) => Promise<{ error: string } | undefined>;

const PERIODS = [
  ["year", "Per year", "Annual salary"],
  ["month", "Per month", "Monthly pay"],
] as const;
const EMPLOYMENT = ["Full-time", "Part-time", "Contract", "Internship"];
const MODES = [
  { v: "On-site", label: "On-site", note: "At the office", Icon: Building2 },
  { v: "Remote", label: "Remote", note: "Work from home", Icon: Laptop },
  { v: "Hybrid", label: "Hybrid", note: "Some days in office", Icon: Home },
];

export function RoleForm({ action, role, submitLabel, showRescore }: { action: Action; role?: Partial<Role>; submitLabel: string; showRescore?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [period, setPeriod] = useState(role?.salary_period === "month" ? "month" : "year");

  /** Switching year/month converts the amounts already typed (÷ 12 or × 12). The exact yearly
   * figure is remembered, so switching back gives the original number, not a rounded one. */
  const switchPeriod = (to: "year" | "month") => {
    if (to === period) return;
    const form = document.getElementById("role-form") as HTMLFormElement | null;
    for (const name of ["salary_min", "salary_max"]) {
      const el = form?.elements.namedItem(name) as HTMLInputElement | null;
      if (!el) continue;
      const n = parseFloat(el.value.replace(/[^\d.]/g, ""));
      if (!n) continue;
      const untouched = el.dataset.shown === el.value && el.dataset.year;
      const yearly = untouched ? Number(el.dataset.year) : period === "year" ? n : n * 12;
      const shown = Math.round(to === "month" ? yearly / 12 : yearly).toLocaleString("en-GB");
      el.value = shown;
      el.dataset.year = String(yearly);
      el.dataset.shown = shown;
    }
    setPeriod(to);
  };
  const list = (v?: string[]) => (v ?? []).join("\n");
  const editing = !!showRescore;
  return (
    <form id="role-form" action={formAction} className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {!editing && <JobAssistant />}
        <Section n={1} icon={<Briefcase size={16} />} title="Job basics" note="The job title and how the job is done.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label">Job title</label>
              <input name="title" className="field py-3 font-display text-[17px] font-bold" required defaultValue={role?.title} placeholder="e.g. Front Desk Receptionist" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Team <span className="font-normal text-slate">(optional)</span></label>
              <input name="department" className="field" defaultValue={role?.department ?? ""} placeholder="Sales, Customer support, Admin…" />
            </div>
            <div className="md:col-span-2">
              <span className="label">Full or part time</span>
              <div className="flex flex-wrap gap-2">
                {EMPLOYMENT.map((e) => (
                  <label key={e} className="cursor-pointer">
                    <input type="radio" name="employment" value={e} defaultChecked={(role?.employment ?? "Full-time") === e} className="peer sr-only" />
                    <span className="block rounded-xl border border-shell bg-white px-4 py-2 text-[13.5px] font-semibold text-slate peer-checked:border-lagoon peer-checked:bg-lagoon peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-coral hover:border-seafoam">{e}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <span className="label">Work type</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {MODES.map(({ v, label, note, Icon }) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="work_mode" value={v} defaultChecked={(role?.work_mode ?? "On-site") === v} className="peer sr-only" />
                    <span className="flex items-center gap-3 rounded-2xl border-2 border-shell bg-white p-3 peer-checked:border-coral peer-checked:bg-mint peer-focus-visible:ring-2 peer-focus-visible:ring-coral hover:border-seafoam">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pearl text-coral"><Icon size={17} /></span>
                      <span>
                        <span className="block text-[14px] font-bold text-ink">{label}</span>
                        <span className="block text-[12px] text-slate">{note}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section n={2} icon={<Check size={16} />} title="Who you need" note="Every applicant is scored against these points only: skills, experience and availability.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Must-have skills <span className="font-normal text-slate">(one per line)</span></label>
              <textarea name="must_have" rows={5} className="field" defaultValue={list(role?.must_have)} placeholder={"Customer service\nPhone support\nMS Excel"} />
              <p className="mt-1 text-[12px] text-slate">Use simple words people write in CVs.</p>
            </div>
            <div>
              <label className="label">Nice-to-have skills <span className="font-normal text-slate">(one per line)</span></label>
              <textarea name="nice_to_have" rows={5} className="field" defaultValue={list(role?.nice_to_have)} placeholder={"CRM software\nLive chat"} />
              <p className="mt-1 text-[12px] text-slate">Bonus points, not required.</p>
            </div>
            <div>
              <label className="label">Languages <span className="font-normal text-slate">(comma separated)</span></label>
              <input name="languages" className="field" defaultValue={(role?.languages ?? []).join(", ")} placeholder="English" />
            </div>
            <div>
              <label className="label">Minimum experience</label>
              <div className="flex items-center gap-2">
                <input name="min_experience" type="number" min={0} max={20} className="field w-28 text-center font-display text-[17px] font-bold" defaultValue={role?.min_experience ?? 1} />
                <span className="text-[13px] text-slate">year(s)</span>
              </div>
            </div>
          </div>
        </Section>

        <Section n={3} icon={<Wallet size={16} />} title="Pay and schedule" note="Shown on the poster and the apply form.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <span className="label">Salary is paid</span>
              <div className="inline-flex rounded-xl border border-shell bg-pearl p-1">
                {PERIODS.map(([v, label, note]) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="salary_period" value={v} checked={period === v} onChange={() => switchPeriod(v)} className="peer sr-only" />
                    <span className="block rounded-lg px-4 py-2 text-center peer-checked:bg-lagoon peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-coral">
                      <span className="block text-[13.5px] font-bold">{label}</span>
                      <span className="block text-[11px] opacity-75">{note}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Salary from <span className="font-normal text-slate">({CURRENCY} {period === "year" ? "per year" : "per month"})</span></label>
              <Prefixed prefix={CURRENCY}><input name="salary_min" inputMode="numeric" className="field" style={{ paddingLeft: 30 }} defaultValue={role?.salary_min ?? ""} placeholder={period === "year" ? "25,000" : "2,100"} /></Prefixed>
            </div>
            <div>
              <label className="label">Salary up to <span className="font-normal text-slate">({CURRENCY} {period === "year" ? "per year" : "per month"})</span></label>
              <Prefixed prefix={CURRENCY}><input name="salary_max" inputMode="numeric" className="field" style={{ paddingLeft: 30 }} defaultValue={role?.salary_max ?? ""} placeholder={period === "year" ? "30,000" : "2,500"} /></Prefixed>
            </div>
            <div>
              <label className="label">Shift</label>
              <input name="shift" className="field" defaultValue={role?.shift ?? ""} placeholder="Day shift" />
            </div>
            <div>
              <label className="label">Hours</label>
              <input name="hours" className="field" defaultValue={role?.hours ?? ""} placeholder="9:00 am – 5:30 pm, Mon–Fri" />
            </div>
            <div>
              <label className="label">Start date <span className="font-normal text-slate">(optional)</span></label>
              <input name="start_date" type="date" className="field" defaultValue={role?.start_date ?? ""} />
            </div>
          </div>
        </Section>

        <Section n={4} icon={<MapPin size={16} />} title="Location and openings" note="Where the job is and how many people you need.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Area / address <span className="font-normal text-slate">(not needed for remote)</span></label>
              <input name="location" className="field" defaultValue={role?.location ?? ""} placeholder="Shoreditch, London" />
            </div>
            <div>
              <label className="label">City</label>
              <input name="city" className="field" defaultValue={role?.city ?? ""} placeholder="London" />
            </div>
            <div className="md:col-span-2">
              <label className="label">How many people do you need?</label>
              <div className="flex flex-wrap items-center gap-3">
                <input name="openings" type="number" min={1} max={100} required className="field w-28 text-center font-display text-[17px] font-bold" defaultValue={role?.openings ?? 1} />
                <p className="flex items-center gap-1.5 text-[12.5px] text-slate"><Users size={13} className="text-coral" /> The job closes by itself when this many people are hired.</p>
              </div>
            </div>
          </div>
        </Section>

        <Section n={5} icon={<MessageSquareText size={16} />} title="Extra details" note="Optional. The assistant fills in the duties if you leave them empty." optional>
          <div className="grid gap-4">
            <div>
              <label className="label">Main duties <span className="font-normal text-slate">(one per line)</span></label>
              <textarea name="duties" rows={3} className="field" defaultValue={(role?.duties ?? []).join("\n")} placeholder={"Answer customer calls and WhatsApp messages\nLog every case in the system"} />
            </div>
            <div>
              <label className="label">Anything else the writer should know?</label>
              <textarea name="notes" rows={2} className="field" defaultValue={role?.notes ?? ""} placeholder="Our customers are families, so warmth matters more than speed." />
            </div>
          </div>
        </Section>

        {!editing && (
          <Section n={6} icon={<FileText size={16} />} title="Job description" note="The full job post people read before they apply. The assistant writes it; change anything you like.">
            <DescriptionField />
          </Section>
        )}
      </div>

      {/* Sticky summary + submit */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          <div className="bridge-gradient px-5 py-4 text-white">
            <div className="flex items-center gap-2 font-display text-[16px] font-extrabold"><Sparkles size={16} className="text-[#5db6f7]" /> {editing ? "Save your changes" : "What you'll get"}</div>
            <p className="mt-1 text-[12.5px] text-white/75">{editing ? "Changes apply to new applicants straight away." : "Ready in about a minute. It starts as a draft."}</p>
          </div>
          {!editing && (
            <ul className="space-y-2.5 px-5 py-4 text-[13.5px] text-ink">
              {[
                [FileText, "A full job description"],
                [Share2, "Captions for Facebook, Instagram, LinkedIn and WhatsApp"],
                [Palette, "A poster you can edit like Canva, in 4 sizes"],
                [Check, "Screening questions for the apply form"],
                [CalendarDays, "An apply link and website form snippet"],
              ].map(([Icon, t]) => {
                const I = Icon as typeof FileText;
                return (
                  <li key={t as string} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint text-coral"><I size={11} /></span>
                    {t as string}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="space-y-3 border-t border-shell bg-pearl/60 px-5 py-4">
            {state?.error && <p className="rounded-xl bg-rust-soft px-3 py-2 text-[13px] font-semibold text-rust">{state.error}</p>}
            {showRescore && (
              <label className="flex items-start gap-2 text-[13px] text-slate">
                <input type="checkbox" name="rescore" className="mt-0.5 accent-lagoon" /> Re-score existing applicants with the new profile
              </label>
            )}
            <button className="btn btn-primary w-full py-3 text-[14.5px]" disabled={pending}>
              {pending ? (editing ? "Saving…" : "Writing the job post and poster…") : submitLabel}
            </button>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({ n, icon, title, note, children, optional }: { n: number; icon: React.ReactNode; title: string; note: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-shell px-6 py-4">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-coral">
          {icon}
          <span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-lagoon text-[10.5px] font-extrabold text-white">{n}</span>
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[17px] font-extrabold text-lagoon">{title}{optional && <span className="chip bg-pearl text-[11px] font-semibold text-slate">Optional</span>}</h2>
          <p className="text-[12.5px] text-slate">{note}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Prefixed({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] font-bold text-slate">{prefix}</span>
      {children}
    </div>
  );
}
