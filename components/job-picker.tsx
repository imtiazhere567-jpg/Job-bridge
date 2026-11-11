"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface PickJob {
  id: number;
  title: string;
  status?: string;
}

const STATUS: Record<string, { label: string; chip: string; dot: string }> = {
  open: { label: "Live", chip: "bg-[#E3F4EC] text-seafoam-dark", dot: "bg-seafoam-dark" },
  draft: { label: "Draft", chip: "bg-amber-soft text-amber", dot: "bg-amber" },
  closed: { label: "Closed", chip: "bg-pearl text-slate", dot: "bg-silver" },
};
const statusOf = (j: PickJob) => STATUS[j.status ?? "open"] ?? STATUS.open;

/**
 * Pick one or more jobs, with search. An empty selection means "all jobs".
 * Live, draft and closed jobs are grouped and labelled so it is clear which is which.
 */
export function JobPicker({ jobs, value, onChange }: { jobs: PickJob[]; value: number[]; onChange: (ids: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return jobs.filter((j) => !t || j.title.toLowerCase().includes(t));
  }, [jobs, q]);
  const groups = [
    { key: "open", title: "Live jobs", items: matches.filter((j) => (j.status ?? "open") === "open") },
    { key: "draft", title: "Drafts", items: matches.filter((j) => j.status === "draft") },
    { key: "closed", title: "Closed jobs", items: matches.filter((j) => j.status === "closed") },
  ].filter((g) => g.items.length);

  const all = value.length === 0 || value.length === jobs.length;
  const toggle = (id: number) => {
    const set = new Set(all ? [] : value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(set.size === jobs.length ? [] : [...set]);
  };
  const chosen = jobs.filter((j) => value.includes(j.id));
  const label = all ? "All jobs" : chosen.length === 1 ? chosen[0].title : `${chosen.length} jobs selected`;

  return (
    <div ref={box} className="relative w-full max-w-[340px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-shell bg-white px-3.5 py-2 text-left text-[13.5px] font-semibold text-lagoon hover:border-seafoam focus-visible:ring-4 focus-visible:ring-coral/15 focus-visible:outline-none"
      >
        {!all && chosen.length === 1 && <span className={`h-2 w-2 shrink-0 rounded-full ${statusOf(chosen[0]).dot}`} />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {!all && chosen.length === 1 && <span className={`chip shrink-0 px-2 py-0.5 text-[10.5px] ${statusOf(chosen[0]).chip}`}>{statusOf(chosen[0]).label}</span>}
        <ChevronDown size={15} className={`shrink-0 text-slate transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1.5 w-full min-w-[300px] overflow-hidden rounded-2xl border border-shell bg-white shadow-[0_18px_50px_rgba(6,59,103,0.22)]">
          <div className="border-b border-shell p-2.5">
            <div className="relative">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs" className="field py-1.5 pr-8 pl-8 text-[13px]" aria-label="Search jobs" />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate hover:text-lagoon">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto py-1.5">
            {!q && (
              <Row checked={all} onClick={() => onChange([])}>
                <span className="font-bold text-lagoon">All jobs</span>
                <span className="ml-auto text-[11.5px] text-slate">{jobs.length}</span>
              </Row>
            )}
            {groups.map((g) => (
              <div key={g.key}>
                <div className="mt-1 flex items-center gap-2 px-3.5 pt-2 pb-1 text-[10.5px] font-bold tracking-wider text-slate uppercase">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS[g.key].dot}`} /> {g.title}
                </div>
                {g.items.map((j) => (
                  <Row key={j.id} checked={!all && value.includes(j.id)} onClick={() => toggle(j.id)}>
                    <span className="min-w-0 flex-1 truncate text-ink">{j.title}</span>
                    <span className={`chip shrink-0 px-2 py-0.5 text-[10.5px] ${statusOf(j).chip}`}>{statusOf(j).label}</span>
                  </Row>
                ))}
              </div>
            ))}
            {groups.length === 0 && <p className="px-3.5 py-3 text-[13px] text-slate">No job called &quot;{q}&quot;.</p>}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-shell bg-pearl/60 px-3.5 py-2">
            <span className="text-[12px] text-slate">{all ? "Showing all jobs" : `${chosen.length} selected`}</span>
            <div className="flex gap-1.5">
              {!all && (
                <button type="button" onClick={() => onChange([])} className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-slate hover:text-lagoon">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-lagoon px-3 py-1 text-[12px] font-semibold text-white hover:bg-coral">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} onClick={onClick} className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] hover:bg-pearl ${checked ? "bg-mint/60" : ""}`}>
      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border-2 ${checked ? "border-lagoon bg-lagoon text-white" : "border-shell bg-white"}`}>
        {checked && <Check size={12} strokeWidth={3.5} />}
      </span>
      {children}
    </button>
  );
}
