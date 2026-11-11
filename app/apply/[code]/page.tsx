import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApplyPanel } from "@/components/apply-panel";
import { Logo } from "@/components/logo";
import { currentUser } from "@/lib/auth";
import { SOURCES } from "@/lib/format";
import { placeText, salaryText } from "@/lib/jobpost";
import { jobByCode } from "@/lib/jobs";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const job = await jobByCode((await params).code);
  if (!job) return { title: "Job not found" };
  const desc = [salaryText(job.role), job.role.employment, placeText(job.role)].filter(Boolean).join(" · ");
  return {
    title: `Apply: ${job.role.title}`,
    description: desc,
    // Facebook, LinkedIn and WhatsApp show the job poster when the link is pasted.
    openGraph: { title: `${job.role.title} at ${job.company.name}`, description: `Apply in 3 minutes. ${desc}`, images: [`/api/poster/${job.role.id}?size=linkedin`] },
  };
}

/** The share link opens here: the apply form straight away, with the key job details on top. */
export default async function ApplyPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ src?: string }> }) {
  const { code } = await params;
  const { src } = await searchParams;
  const job = await jobByCode(code);
  if (!job) notFound();
  if (job.role.status === "draft" && !(await currentUser())) notFound();
  // Old code links (/apply/c5532c) move to the job's name: /apply/customer-support-officer
  if (decodeURIComponent(code).toLowerCase() !== job.role.slug) redirect(`/apply/${job.role.slug}${src ? `?src=${encodeURIComponent(src)}` : ""}`);
  return (
    <div className="min-h-screen bg-pearl">
      <header className="border-b border-shell bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-4">
          <Logo size={40} />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        {job.role.status === "draft" && <div className="mb-4 rounded-xl bg-amber-soft px-4 py-2.5 text-center text-sm font-bold text-amber">Draft preview. Only you can see this until the job is published.</div>}
        <ApplyPanel role={job.role} company={job.company} src={src && src in SOURCES ? src : "link"} embed={false} preview={job.role.status === "draft"} />
      </main>
    </div>
  );
}
