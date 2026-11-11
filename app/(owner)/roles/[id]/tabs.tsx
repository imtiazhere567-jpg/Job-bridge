import Link from "next/link";
import { ArrowLeft, Clock, ExternalLink, FileEdit, FileText, MapPin, Palette, Pencil, Trash2, Users, Wallet } from "lucide-react";
import { Submit } from "@/components/client";
import { BrandStar } from "@/components/logo";
import { RoleStatusChip } from "@/components/ui";
import { placeText, salaryText } from "@/lib/jobpost";
import type { Role } from "@/lib/types";
import { deleteRole, setStatus } from "../actions";

/** Job header: brand banner with the key facts, status actions and the page tabs. */
/** `justCreated`: the page you land on after creating a job; the back link then returns to the job details you filled in. */
export function RoleHeader({ role, tab, counts, justCreated = false, back, from }: { role: Role; tab: "post" | "poster" | "applicants"; counts: { applicants: number; hired: number }; justCreated?: boolean; back?: { href: string; label: string }; from?: string }) {
  const filled = Math.min(100, (counts.hired / Math.max(1, role.openings)) * 100);
  const facts = [
    { icon: Wallet, text: salaryText(role) },
    { icon: Clock, text: [role.employment, role.shift].filter(Boolean).join(" · ") },
    { icon: MapPin, text: placeText(role) },
  ].filter((f) => f.text);
  const tabs = [
    ["post", "Post & sharing", `/roles/${role.slug}`, FileText],
    ["poster", "Poster editor", `/roles/${role.slug}/poster`, Palette],
    ["applicants", `Applicants (${counts.applicants})`, `/roles/${role.slug}/applicants`, Users],
  ] as const;
  // While a job is still a draft nobody can apply yet, so there are no applicants to show
  // (a job moved back to draft keeps the tab if it already has applicants).
  const preparing = role.status === "draft" && counts.applicants === 0;
  const shownTabs = preparing ? tabs.filter(([key]) => key !== "applicants") : tabs;
  return (
    <div className="mb-6">
      <Link href={justCreated ? `/roles/${role.slug}/edit` : back?.href ?? "/roles"} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-lagoon"><ArrowLeft size={14} /> {justCreated ? "Back to the job details" : back?.label ?? "All jobs"}</Link>
      <section className="bridge-gradient relative mt-3 overflow-clip rounded-[22px] p-6 text-white sm:p-8">
        <svg className="pointer-events-none absolute -right-10 -bottom-6 hidden sm:block" width="420" height="190" viewBox="0 0 420 190" aria-hidden="true">
          <path d="M10 190C80 20 340 20 410 190" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="40" />
          <path d="M100 190C140 90 280 90 320 190" fill="none" stroke="rgba(93,182,247,0.28)" strokeWidth="16" />
        </svg>
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 text-[11.5px] font-bold tracking-[0.16em] text-[#5db6f7] uppercase"><BrandStar size={11} /> {role.department ?? "Job"}</span>
              <RoleStatusChip status={role.status} reason={role.closed_reason} />
            </div>
            <h1 className="mt-2 font-display text-[30px] leading-tight font-extrabold sm:text-[36px]">{role.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {facts.map((f) => (
                <span key={f.text} className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12.5px] font-semibold">
                  <f.icon size={13} className="text-[#5db6f7]" /> {f.text}
                </span>
              ))}
            </div>
            {preparing ? (
              <p className="mt-4 text-[12.5px] font-semibold text-white/75">
                Hiring {role.openings} {role.openings === 1 ? "person" : "people"} · applications open once you publish
              </p>
            ) : (
              <div className="mt-4 flex max-w-xs items-center gap-3 text-[12.5px]">
                <span className="font-semibold whitespace-nowrap">{counts.hired} of {role.openings} hired</span>
                <div className="h-1.5 flex-1 rounded-full bg-white/15"><div className="h-1.5 rounded-full bg-[#5db6f7]" style={{ width: `${filled}%` }} /></div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/roles/${role.slug}/edit`} className="btn border border-white/25 bg-white/10 text-white hover:bg-white/20"><Pencil size={14} /> Edit job</Link>
            <Link href={`/apply/${role.slug}`} target="_blank" className="btn border border-white/25 bg-white/10 text-white hover:bg-white/20"><ExternalLink size={14} /> {role.status === "open" ? "Apply form" : "Preview"}</Link>
            {(role.status === "open" || role.status === "closed") && (
              <form action={setStatus.bind(null, role.id, "draft")}>
                <Submit className="btn border border-white/25 bg-white/10 text-white hover:bg-white/20" pendingText="Moving…" confirm="Move this job back to draft? It will leave the careers site, and its share links and poster QR code will stop working until you publish it again. Applicants are kept.">
                  <FileEdit size={14} /> Move to draft
                </Submit>
              </form>
            )}
            {role.status === "draft" && (
              <form action={setStatus.bind(null, role.id, "publish")}>
                <Submit className="btn bg-white text-lagoon hover:bg-mint" pendingText="Publishing…">Publish job</Submit>
              </form>
            )}
            {role.status === "open" && (
              <form action={setStatus.bind(null, role.id, "close")}>
                <Submit className="btn bg-white text-lagoon hover:bg-mint" confirm="Close this job? It will leave the careers site and stop taking applications.">Close job</Submit>
              </form>
            )}
            {role.status === "closed" && counts.hired < role.openings && (
              <form action={setStatus.bind(null, role.id, "reopen")}>
                <Submit className="btn bg-white text-lagoon hover:bg-mint" pendingText="Reopening…">Reopen job</Submit>
              </form>
            )}
            <form action={deleteRole.bind(null, role.id)}>
              <Submit
                className="btn border border-white/25 bg-white/10 text-white hover:border-[#F2B8B5] hover:bg-[#B3261E]/80"
                pendingText="Deleting…"
                confirm={`Delete this job? "${role.title}" will be removed for good${counts.applicants ? `, together with ${counts.applicants === 1 ? "its 1 applicant and their CV, interview and messages" : `its ${counts.applicants} applicants and their CVs, interviews and messages`}` : ", with its posters and links"}. This can't be undone.${role.status === "open" ? " To stop applications but keep everything, use Close job instead." : ""}`}
              >
                <Trash2 size={14} /> Delete
              </Submit>
            </form>
          </div>
        </div>
      </section>
      <nav className="mt-4 flex flex-wrap gap-1 rounded-2xl border border-shell bg-white p-1.5">
        {shownTabs.map(([key, label, href, Icon]) => (
          // The tabs keep "where you came from", so the back link stays the same on every tab.
          <Link key={key} href={from && !justCreated ? `${href}?from=${encodeURIComponent(from)}` : href} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-semibold ${tab === key ? "bg-lagoon text-white" : "text-slate hover:bg-pearl hover:text-lagoon"}`}>
            <Icon size={15} /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
