"use client";

import { useState } from "react";
import { SOURCES } from "@/lib/format";
import { JobPicker } from "./job-picker";

export interface SourceRow {
  role_id: number;
  source: string;
  n: number;
}

/** "Where applicants come from", per job: pick a job to see its own sources (or all jobs together). */
export function SourcesCard({ jobs, rows, fixedJob }: { jobs: { id: number; title: string; status?: string }[]; rows: SourceRow[]; fixedJob?: number }) {
  // Empty = all jobs. Starts on the first live job so the card is about something specific.
  const [ids, setIds] = useState<number[]>(fixedJob ? [fixedJob] : jobs.length ? [jobs[0].id] : []);
  const picked = rows.filter((r) => ids.length === 0 || ids.includes(r.role_id));
  const totals = new Map<string, number>();
  for (const r of picked) totals.set(r.source, (totals.get(r.source) ?? 0) + r.n);
  const list = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = list.reduce((s, [, n]) => s + n, 0);
  const max = Math.max(1, ...list.map(([, n]) => n));
  const best = list[0];

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-shell px-6 py-4">
        <h3 className="font-display text-lg font-extrabold text-ink">Where applicants come from</h3>
        {!fixedJob && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <JobPicker jobs={jobs} value={ids} onChange={setIds} />
          </div>
        )}
      </div>
      <div className="px-6 py-5">
        {total > 0 && best && (
          <p className="mb-4 rounded-xl bg-mint px-3.5 py-2.5 text-[13px] text-lagoon">
            <b>{total}</b> applicant{total === 1 ? "" : "s"}.{" "}
            {list.length > 1 && list[1][1] === best[1] ? (
              <>Spread across <b>{list.length}</b> places, with no single top source yet.</>
            ) : (
              <>Most came from <b>{SOURCES[best[0]] ?? best[0]}</b> ({Math.round((best[1] / total) * 100)}%).</>
            )}
          </p>
        )}
        <div className="space-y-3">
          {list.map(([s, n]) => (
            <div key={s} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-slate">{SOURCES[s] ?? s}</span>
                <span className="shrink-0 font-semibold text-ink">{n} <span className="text-[11.5px] font-normal text-slate">· {Math.round((n / total) * 100)}%</span></span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-pearl">
                <div className="h-2 rounded-full bg-seafoam" style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-slate">No applications yet{ids.length === 1 ? " for this job. Share its apply link to start" : ""}.</p>}
        </div>
      </div>
    </div>
  );
}
