import { Briefcase, CalendarDays, Clock, Languages, MapPin, Users, Wallet } from "lucide-react";
import { JobDescription } from "@/components/job-description";
import { ApplyForm } from "@/app/(site)/jobs/[slug]/apply-form";
import { applyByCode } from "@/app/(site)/jobs/[slug]/actions";
import { placeText, salaryText } from "@/lib/jobpost";
import { fmtDate } from "@/lib/format";
import type { JobRow } from "@/lib/jobs";
import type { Company } from "@/lib/types";
import { ApplyToggle } from "./apply-toggle";
import { BrandStar } from "./logo";

/** Job summary + apply form, used by the share link page and the website form snippet. */
/** `preview`: the owner looking at a draft. The form shows so they can check it, but nothing can be sent until it is published. */
export function ApplyPanel({ role, company, src, embed, preview = false }: { role: JobRow; company: Company; src: string; embed: boolean; preview?: boolean }) {
  const chips = [
    { icon: Wallet, text: salaryText(role) },
    { icon: Clock, text: [role.employment, role.shift].filter(Boolean).join(" · ") },
    { icon: role.work_mode === "Remote" ? Briefcase : MapPin, text: placeText(role) },
  ].filter((c) => c.text);
  const open = role.status === "open" || preview;
  return (
    <div className="card overflow-hidden">
      <div className="bridge-gradient relative overflow-clip px-6 py-6 text-white sm:px-8">
        <svg className="pointer-events-none absolute -right-8 -bottom-4" width="260" height="120" viewBox="0 0 260 120" aria-hidden="true">
          <path d="M8 120C50 14 210 14 252 120" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="28" />
        </svg>
        <div className="relative">
          <div className="flex items-center gap-2 text-[11.5px] font-bold tracking-[0.16em] text-[#5db6f7] uppercase">
            <BrandStar size={11} /> {role.openings > 1 ? `${role.openings - role.hired} open position${role.openings - role.hired === 1 ? "" : "s"}` : "We're hiring"}
          </div>
          <h1 className="mt-2 font-display text-[26px] leading-tight font-extrabold sm:text-[30px]">{role.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span key={c.text} className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[12.5px] font-semibold">
                <c.icon size={13} /> {c.text}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="p-6 sm:p-8">
        {open ? (
          <ApplyToggle
            form={<ApplyForm action={applyByCode.bind(null, role.code, embed)} questions={role.screening} fields={role.form_fields} src={src} company={company.name} accent="#047CD3" />}
            details={<JobDetails role={role} company={company} />}
          />
        ) : (
          <p className="rounded-xl bg-pearl p-5 text-center text-sm text-slate">
            {role.status === "closed" ? "This job is closed. Thank you for your interest." : "Applications open once this job is published."}
          </p>
        )}
      </div>
    </div>
  );
}

/** "Thank you" message after applying from the link or the snippet. */
export function ApplyThanks({ title, company, again, first }: { title: string; company: string; again: boolean; first?: string }) {
  return (
    <div className="card px-6 py-12 text-center sm:px-10">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#E3F4EC]">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-seafoam-dark" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h1 className="mt-5 font-display text-[26px] font-extrabold text-lagoon">{again ? "We've updated your application" : `Thank you${first ? `, ${first}` : ""}!`}</h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate">
        {again
          ? `You had already applied for ${title}, so we updated your details instead of creating a second application.`
          : `${company} has received your application for ${title}. You'll get a confirmation on WhatsApp/email.`}{" "}
        If you are shortlisted, you will get a link to choose an interview time.
      </p>
    </div>
  );
}

/** The full job description shown in place of the form. */
function JobDetails({ role, company }: { role: JobRow; company: Company }) {
  const facts = [
    { icon: Briefcase, label: "Work type", value: role.work_mode },
    { icon: Clock, label: "Hours", value: role.hours },
    { icon: Wallet, label: "Salary", value: salaryText(role) },
    { icon: MapPin, label: "Location", value: role.work_mode === "Remote" ? "Work from home" : role.location ?? role.city ?? company.city },
    { icon: Users, label: "Openings", value: role.openings > 1 ? `${role.openings - role.hired} of ${role.openings} still open` : "1 post" },
    { icon: Languages, label: "Languages", value: role.languages.join(", ") },
    { icon: CalendarDays, label: "Start date", value: role.start_date ? fmtDate(role.start_date) : null },
  ].filter((f) => f.value);
  return (
    <div>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl border border-shell bg-pearl/60 px-3.5 py-2.5">
            <dt className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider text-coral uppercase"><f.icon size={11} /> {f.label}</dt>
            <dd className="mt-0.5 text-[13.5px] font-bold text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
      <JobDescription body text={role.description ?? ""} className="mt-6 text-[15px] text-ink" />
    </div>
  );
}
