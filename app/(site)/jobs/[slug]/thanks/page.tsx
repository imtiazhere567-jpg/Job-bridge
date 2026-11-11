import { fmtTime } from "@/lib/format";
import { jobBySlug } from "@/lib/jobs";
import { demoMode, templates } from "@/lib/messages";
import type { Applicant } from "@/lib/types";

export const metadata = { title: "Application received" };

export default async function Thanks({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ again?: string; n?: string }> }) {
  const { slug } = await params;
  const { again, n } = await searchParams;
  const job = await jobBySlug(slug);
  const role = job?.role;
  const company = job?.company;
  // Demo: show the WhatsApp confirmation the applicant just got (nothing is sent to real phones).
  const preview = demoMode() && role && company && n ? templates.received({ name: n } as Applicant, role, company).body.replace(/\n\n+/g, "\n\n") : null;
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="arch mx-auto grid h-24 w-20 place-items-center bg-mint">
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-seafoam-dark" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-[34px] font-semibold text-lagoon">{again ? "We've updated your application" : "Thank you, application received"}</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-slate">
        {again
          ? `You had already applied for ${role?.title ?? "this job"}, so we updated your details instead of creating a second application.`
          : `${company?.name ?? "The company"} has received your application for ${role?.title ?? "this job"}, and sent you a confirmation on WhatsApp/email.`}{" "}
        If you are shortlisted, you will get a link to choose an interview time.
      </p>

      {preview && company && (
        <div className="mx-auto mt-10 max-w-sm text-left">
          <div className="eyebrow mb-2 text-center">Demo · the WhatsApp message you just received</div>
          <div className="overflow-hidden rounded-[18px] border border-shell shadow-sm">
            <div className="flex items-center gap-3 bg-[#008069] px-4 py-3 text-white">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-bold">{company.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</div>
              <div>
                <div className="text-[14px] font-semibold">{company.name}</div>
                <div className="text-[11.5px] text-white/80">Business account</div>
              </div>
            </div>
            <div className="p-4" style={{ background: "#EFEAE2" }}>
              <div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-3 pt-2 pb-1 text-[13.5px] leading-snug whitespace-pre-line text-ink shadow-sm">
                {preview}
                <div className="mt-1 text-right text-[11px] text-[#667781]">{fmtTime(new Date())}</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
