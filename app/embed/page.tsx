import { JobCard } from "@/components/job-card";
import { LogoMark } from "@/components/logo";
import { openJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Open jobs" };

/** Careers list for the website snippet (iframe): no header or footer, links open the full job page. */
export default async function Embed() {
  const jobs = await openJobs();
  return (
    <div className="bg-pearl p-4">
      <base target="_top" />
      <div className="space-y-3">
        {jobs.map((j) => <JobCard key={j.id} job={j} src="website" />)}
        {jobs.length === 0 && <p className="card p-10 text-center text-sm text-slate">No open jobs right now.</p>}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-slate"><LogoMark size={18} /> Careers by JobBridge</div>
    </div>
  );
}
