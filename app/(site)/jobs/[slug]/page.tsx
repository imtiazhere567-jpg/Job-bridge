import { notFound } from "next/navigation";
import { JobDescription } from "@/components/job-description";
import { Briefcase, CalendarDays, Clock, Languages, MapPin, Users, Wallet } from "lucide-react";
import { BrandStar } from "@/components/logo";
import { currentUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { placeText, salaryText } from "@/lib/jobpost";
import { jobBySlug } from "@/lib/jobs";
import { apply } from "./actions";
import { ApplyForm } from "./apply-form";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await jobBySlug(slug);
  if (!job) return { title: "Job" };
  return {
    title: `${job.role.title} · Careers`,
    description: `${job.role.employment} · ${salaryText(job.role)} · ${placeText(job.role) || job.company.city || ""}`,
    openGraph: { images: [`/api/poster/${job.role.id}?size=linkedin`] },
  };
}

export default async function JobPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string }> }) {
  const { slug } = await params;
  const { src } = await searchParams;
  const job = await jobBySlug(slug);
  if (!job) notFound();
  const { role, company } = job;
  // Drafts are only visible to the signed-in owner, as a preview.
  if (role.status === "draft" && !(await currentUser())) notFound();

  const facts = [
    { icon: Clock, label: "Type", value: [role.employment, role.shift].filter(Boolean).join(", ") },
    { icon: Clock, label: "Hours", value: role.hours },
    { icon: Wallet, label: "Salary", value: salaryText(role) },
    { icon: Briefcase, label: "Work type", value: role.work_mode },
    { icon: MapPin, label: "Location", value: role.work_mode === "Remote" ? "Work from home" : role.location ?? role.city },
    { icon: Users, label: "Openings", value: role.openings > 1 ? `${role.openings - role.hired} of ${role.openings} still open` : "1 post" },
    { icon: Languages, label: "Languages", value: role.languages.join(", ") },
    { icon: CalendarDays, label: "Start date", value: role.start_date ? fmtDate(role.start_date) : null },
  ].filter((f) => f.value);

  return (
    <>
      {role.status !== "open" && (
        <div className={`px-4 py-2.5 text-center text-sm font-bold ${role.status === "closed" ? "bg-shell text-slate" : "bg-amber-soft text-amber"}`}>
          {role.status === "closed" ? "This job is closed. All positions have been filled." : "Draft preview. This job is not public yet."}
        </div>
      )}
      <section className="bridge-gradient relative overflow-clip text-white">
        <svg className="absolute -right-16 bottom-0 hidden sm:block" width="520" height="240" viewBox="0 0 520 240" aria-hidden="true">
          <path d="M20 240C100 40 420 40 500 240" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="48" />
        </svg>
        <div className="relative mx-auto max-w-[1160px] px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] text-[#5db6f7] uppercase"><BrandStar size={11} /> {role.department ?? company.name}</div>
          <h1 className="mt-2 font-display text-[36px] leading-tight font-extrabold tracking-[-0.01em] sm:text-[44px]">{role.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {[salaryText(role), role.employment, placeText(role)].filter(Boolean).map((t) => (
              <span key={t} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[13px] font-semibold">{t}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1160px] px-4 pt-8 pb-20 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <article>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="card px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-coral uppercase"><f.icon size={12} /> {f.label}</dt>
                  <dd className="mt-1 text-[14px] font-bold text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
            <JobDescription body text={role.description ?? ""} className="mt-8 text-[15.5px] text-ink" />
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card overflow-hidden">
              <div className="bridge-gradient px-6 py-5 text-white">
                <div className="font-display text-xl font-extrabold">Apply in about 3 minutes</div>
                <p className="mt-1 text-[13px] text-white/75">No account needed. You get a confirmation on WhatsApp straight away.</p>
              </div>
              <div className="p-6">
                {role.status !== "open" ? (
                  <p className="text-sm text-slate">{role.status === "closed" ? "This job is closed. Thank you for your interest." : "Applications open once this job is published."}</p>
                ) : (
                  <ApplyForm action={apply.bind(null, role.slug)} questions={role.screening} fields={role.form_fields} src={src ?? "link"} company={company.name} accent="#047CD3" />
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
