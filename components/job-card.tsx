import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Users, Wallet } from "lucide-react";
import { placeText, salaryText } from "@/lib/jobpost";
import type { JobRow } from "@/lib/jobs";
import { ago } from "@/lib/format";
import { BrandStar } from "./logo";

/** One job on the careers site: a white "ticket" with a navy department tab. */
export function JobCard({ job, src }: { job: JobRow; src?: string }) {
  const left = job.openings - job.hired;
  return (
    <Link href={`/jobs/${job.slug}${src ? `?src=${src}` : ""}`} className="card group flex flex-col gap-4 p-5 hover:border-coral sm:flex-row sm:items-center sm:p-6">
      <div className="bridge-gradient grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white">
        <BrandStar size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-bold tracking-[0.12em] text-coral uppercase">{job.department ?? "JobBridge team"}</div>
        <div className="mt-0.5 font-display text-[19px] font-extrabold text-lagoon">{job.title}</div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate">
          <span className="flex items-center gap-1.5"><Clock size={13} /> {[job.employment, job.shift].filter(Boolean).join(", ")}</span>
          <span className="flex items-center gap-1.5"><Wallet size={13} /> {salaryText(job)}</span>
          {placeText(job) && <span className="flex items-center gap-1.5"><MapPin size={13} /> {placeText(job)}</span>}
          {job.openings > 1 && <span className="flex items-center gap-1.5"><Users size={13} /> {left} of {job.openings} posts open</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
        <span className="text-[12px] text-slate">{ago(job.reviewed_at ?? job.created_at)}</span>
        <span className="btn btn-coral">Apply <ArrowUpRight size={15} /></span>
      </div>
    </Link>
  );
}
