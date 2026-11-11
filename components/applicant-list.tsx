"use client";

import { askConfirm } from "@/components/dialog";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Briefcase, CalendarCheck2, ChevronRight, Clock, Copy, MapPin, Send, Share2, X } from "lucide-react";
import type { Band } from "@/lib/types";
import { BAND_LABEL, SOURCES } from "@/lib/format";
import { Avatar, ScoreRing, StageChip, WhatsAppLink } from "./ui";

export interface Row {
  id: number;
  slug: string;
  name: string;
  phone?: string | null;
  city: string | null;
  source: string;
  score: number | null;
  band: Band | null;
  stage: string;
  summary: { strengths: string; gaps: string; ask: string } | null;
  duplicate_count: number;
  role_title?: string;
  when: string;
}

const ORDER: Band[] = ["strong", "maybe", "nofit"];
const GROUP: Record<Band, { dot: string; text: string; note: string }> = {
  strong: { dot: "bg-seafoam-dark", text: "text-seafoam-dark", note: "Match the must-haves. Good to shortlist." },
  maybe: { dot: "bg-amber", text: "text-amber", note: "Partly match. Worth a closer look." },
  nofit: { dot: "bg-rust", text: "text-rust", note: "Miss key requirements. Nobody is rejected automatically." },
};

export function ApplicantList({ rows, shortlist, reject, showRole, from }: { from?: string; rows: Row[]; shortlist: (f: FormData) => Promise<void>; reject: (f: FormData) => Promise<void>; showRole?: boolean }) {
  // Nothing is ticked when the page opens; the owner picks applicants (or uses "Select strong fits").
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => ORDER.map((b) => ({ band: b as Band | null, rows: rows.filter((r) => r.band === b) })).concat([{ band: null, rows: rows.filter((r) => !r.band) }]), [rows]);
  const selected = rows.filter((r) => sel.has(r.id));
  const canInvite = selected.filter((r) => r.stage === "applied" || r.stage === "rejected");
  const canReject = selected.filter((r) => r.stage !== "rejected" && r.stage !== "hired");

  const toggle = (id: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const run = async (fn: (f: FormData) => Promise<void>, list: Row[], confirmText?: string) => {
    if (!list.length || (confirmText && !(await askConfirm(confirmText)))) return;
    const f = new FormData();
    list.forEach((r) => f.append("ids", String(r.id)));
    setBusy(true);
    await fn(f);
    setSel(new Set());
    setBusy(false);
  };

  return (
    <div>
      <div className={`sticky top-0 z-10 mb-6 flex flex-wrap items-center gap-3 rounded-2xl border p-3 px-4 shadow-sm ${selected.length ? "border-coral/40 bg-mint" : "border-shell bg-white"}`}>
        <span className="flex items-center gap-2 text-sm text-slate">
          <span className={`grid h-7 min-w-7 place-items-center rounded-full px-2 font-display text-[13px] font-extrabold ${selected.length ? "bg-coral text-white" : "bg-pearl text-slate"}`}>{selected.length}</span>
          selected
        </span>
        <button type="button" className="text-[13px] font-semibold text-coral hover:underline" onClick={() => setSel(new Set(rows.filter((r) => r.band === "strong" && r.stage === "applied").map((r) => r.id)))}>Select strong fits</button>
        {selected.length > 0 && <button type="button" className="text-[13px] text-slate hover:underline" onClick={() => setSel(new Set())}>Clear</button>}
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" disabled={busy || !canReject.length} className="btn btn-ghost disabled:opacity-40" onClick={() => run(reject, canReject, `Send a polite "not selected" message to ${canReject.length} applicant(s)?`)}>
            <X size={15} /> Not selected ({canReject.length})
          </button>
          <button type="button" disabled={busy || !canInvite.length} className="btn btn-primary disabled:opacity-40" onClick={() => run(shortlist, canInvite)}>
            <CalendarCheck2 size={15} /> {busy ? "Sending…" : `Shortlist & send booking links (${canInvite.length})`}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {groups.filter((g) => g.rows.length).map((g) => {
          const style = g.band ? GROUP[g.band] : { dot: "bg-silver", text: "text-slate", note: "Waiting to be scored." };
          return (
            <section key={g.band ?? "none"}>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`h-3 w-3 rounded-full ${style.dot}`} />
                <h3 className={`font-display text-lg font-extrabold ${style.text}`}>{g.band ? BAND_LABEL[g.band] : "Not scored"}</h3>
                <span className="chip bg-white px-2 py-0 text-[12px] text-slate border border-shell">{g.rows.length}</span>
                <span className="text-[13px] text-slate">{style.note}</span>
              </div>
              <div className="space-y-3">
                {g.rows.map((r) => {
                  const on = sel.has(r.id);
                  return (
                    <div key={r.id} className={`card flex items-center gap-4 p-4 sm:px-5 ${on ? "border-coral ring-2 ring-coral/15" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(r.id)} className="h-4 w-4 shrink-0 accent-lagoon" aria-label={`Select ${r.name}`} />
                      <div className="hidden sm:block"><Avatar name={r.name} size={44} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <Link href={`/applicants/${r.slug}${from ? `?from=${from}` : ""}`} className="font-display text-[16px] font-extrabold text-ink hover:text-coral">{r.name}</Link>
                          <StageChip stage={r.stage} />
                          {r.duplicate_count > 0 && <span className="chip border border-shell bg-pearl text-slate"><Copy size={11} /> applied {r.duplicate_count + 1}×</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate">
                          {showRole && r.role_title && <span className="flex items-center gap-1"><Briefcase size={12} /> {r.role_title}</span>}
                          {r.city && <span className="flex items-center gap-1"><MapPin size={12} /> {r.city}</span>}
                          <span className="flex items-center gap-1"><Share2 size={12} /> {SOURCES[r.source] ?? r.source}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {r.when}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <ScoreRing score={r.score} band={r.band} />
                        <div className="flex items-center gap-2">
                          <WhatsAppLink phone={r.phone} text={`Hi ${r.name.split(" ")[0]}, this is JobBridge about your job application.`} compact />
                          <Link href={`/applicants/${r.slug}${from ? `?from=${from}` : ""}`} className="grid h-9 w-9 place-items-center rounded-full border border-shell text-lagoon hover:border-coral hover:text-coral" aria-label={`Open ${r.name}`}>
                            <ChevronRight size={17} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {rows.length === 0 && <p className="card p-10 text-center text-sm text-slate">No applicants match.</p>}
      <p className="mt-6 flex items-center gap-2 text-[12.5px] text-slate"><Send size={13} /> Nothing is sent until you press a button. Scores are suggestions; you decide.</p>
    </div>
  );
}

