import Link from "next/link";
import { cookies } from "next/headers";
import { Briefcase, CalendarDays, Clock, Copy, FileText, Home, MapPin, Palette, Plus, Users, Wallet } from "lucide-react";
import { Empty, HeroHeader, Notice, RoleStatusChip } from "@/components/ui";
import { ViewToggle } from "@/components/view-toggle";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { placeText, salaryText } from "@/lib/jobpost";
import type { Role } from "@/lib/types";

export const metadata = { title: "Jobs" };

const FILTERS = [
  ["", "All jobs"],
  ["open", "Live"],
  ["draft", "Drafts"],
  ["closed", "Closed"],
] as const;

const TILE: Record<string, string> = { open: "bg-mint text-coral", draft: "bg-amber-soft text-amber", closed: "bg-pearl text-silver" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ status?: string; deleted?: string }> }) {
  const { status: raw, deleted } = await searchParams;
  const status = FILTERS.some(([k]) => k && k === raw) ? raw! : "";
  const { company } = await requireEmployer();
  const view = (await cookies()).get("jobs_view")?.value === "list" ? "list" : "grid";
  const all = await db.q<Role & { applicants: number; hired: number; strong: number; fresh: number }>(
    `select r.*, count(a.id)::int as applicants,
            count(*) filter (where a.stage = 'hired')::int as hired,
            count(*) filter (where a.band = 'strong' and a.stage = 'applied')::int as strong,
            count(*) filter (where a.created_at > now() - interval '7 days')::int as fresh
     from roles r left join applicants a on a.role_id = r.id where r.company_id = $1 group by r.id
     order by case r.status when 'draft' then 0 when 'open' then 1 else 2 end, r.created_at desc`,
    [company.id],
  );
  const count = (s: string) => (s ? all.filter((r) => r.status === s).length : all.length);
  const roles = status ? all.filter((r) => r.status === status) : all;
  const tab = (active: boolean) => `flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold ${active ? "bg-lagoon text-white" : "text-slate hover:bg-pearl hover:text-lagoon"}`;

  return (
    <>
      <HeroHeader
        eyebrow="Jobs & posters"
        title="Your jobs"
        sub="Every job starts as a draft with its post and four poster designs ready. Publish it when you are happy. To hire again, copy an old job."
        stats={[
          { label: "Live jobs", value: count("open"), tone: "sky" },
          { label: "Drafts", value: count("draft"), tone: "amber" },
          { label: "Total applicants", value: all.reduce((s, r) => s + r.applicants, 0) },
          { label: "Hired", value: all.reduce((s, r) => s + r.hired, 0), tone: "green" },
        ]}
      >
        <Link href="/roles/new" className="btn bg-white text-lagoon hover:bg-mint">
          <Plus size={16} /> New job
        </Link>
      </HeroHeader>
      {deleted && <div className="mb-5"><Notice tone="ok"><b>{deleted}</b> was deleted, with its applicants, interviews, messages and posters.</Notice></div>}

      <div className="card mb-5 flex flex-wrap items-center gap-2 p-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={k ? `/roles?status=${k}` : "/roles"} className={tab(status === k)}>
              {label} <span className={`rounded-full px-1.5 text-[11px] ${status === k ? "bg-white/20" : "bg-pearl"}`}>{count(k)}</span>
            </Link>
          ))}
        </div>
        <div className="ml-auto"><ViewToggle name="jobs_view" value={view} /></div>
      </div>

      {roles.length === 0 && <Empty title={status ? "No jobs here" : "No jobs yet"}>Click New job and fill in what you need. You&apos;ll get the job post, a poster and a share link.</Empty>}

      {/* List view: one row per job, like the applicants list */}
      {view === "list" && roles.length > 0 && (
        <div className="card divide-y divide-shell overflow-hidden">
          {roles.map((r) => {
            const filled = Math.min(100, (r.hired / Math.max(1, r.openings)) * 100);
            const facts = [salaryText(r), [r.employment, r.shift].filter(Boolean).join(" · "), placeText(r)].filter(Boolean);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 hover:bg-pearl/50">
                <div className="flex min-w-0 grow basis-[300px] items-center gap-3.5">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TILE[r.status] ?? TILE.closed}`}>
                    <Briefcase size={19} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/roles/${r.slug}`} className="truncate font-display text-[16px] font-extrabold text-ink hover:text-coral">{r.title}</Link>
                      <RoleStatusChip status={r.status} reason={r.closed_reason} />
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-slate">{facts.join("  ·  ")}</div>
                  </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-5">
                  <Link href={`/roles/${r.slug}/applicants`} className="text-center hover:text-coral" title="Applicants">
                    <div className="font-display text-[18px] leading-none font-extrabold text-lagoon">{r.applicants}</div>
                    <div className="mt-1 text-[11px] font-semibold text-slate">Applicants</div>
                  </Link>
                  <Link href={`/roles/${r.slug}/applicants`} className="text-center" title="Strong fits waiting for you">
                    <div className={`font-display text-[18px] leading-none font-extrabold ${r.strong ? "text-seafoam-dark" : "text-silver"}`}>{r.strong}</div>
                    <div className="mt-1 text-[11px] font-semibold text-slate">To review</div>
                  </Link>
                  <div className="w-28">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-ink">{r.hired}/{r.openings} hired</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-pearl">
                      <div className={`h-1.5 rounded-full ${r.hired >= r.openings ? "bg-seafoam-dark" : "bg-coral"}`} style={{ width: `${filled}%` }} />
                    </div>
                  </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Link href={`/roles/${r.slug}`} className="grid h-9 w-9 place-items-center rounded-lg text-lagoon hover:bg-white hover:text-coral" title="Post & links" aria-label={`Post and links for ${r.title}`}><FileText size={16} /></Link>
                  <Link href={`/roles/${r.slug}/poster?from=roles`} className="grid h-9 w-9 place-items-center rounded-lg text-lagoon hover:bg-white hover:text-coral" title="Poster" aria-label={`Poster for ${r.title}`}><Palette size={16} /></Link>
                  <Link href={`/roles/new?from=${r.slug}`} className="grid h-9 w-9 place-items-center rounded-lg text-lagoon hover:bg-white hover:text-coral" title="Hire again: copy this job" aria-label={`Copy ${r.title}`}><Copy size={15} /></Link>
                  <Link href={`/roles/${r.slug}/applicants`} className="ml-1 flex items-center gap-1.5 rounded-lg bg-lagoon px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-coral"><Users size={14} /> Applicants</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "grid" && (
      <div className="grid gap-5 xl:grid-cols-2">
        {roles.map((r) => {
          const filled = Math.min(100, (r.hired / Math.max(1, r.openings)) * 100);
          return (
            <div key={r.id} className="card flex flex-col overflow-hidden">
              <div className="flex items-start gap-4 p-5 pb-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${TILE[r.status] ?? TILE.closed}`}>
                  <Briefcase size={21} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/roles/${r.slug}`} className="block truncate font-display text-[18px] leading-tight font-extrabold text-ink hover:text-coral">{r.title}</Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-slate">
                    <RoleStatusChip status={r.status} reason={r.closed_reason} />
                    <span className="flex items-center gap-1"><CalendarDays size={12} /> {fmtDate(r.created_at)}</span>
                  </div>
                </div>
                <Link href={`/roles/new?from=${r.slug}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-shell text-slate hover:border-coral hover:text-coral" title="Hire again: copy this job" aria-label="Hire again">
                  <Copy size={15} />
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 px-5">
                <span className="flex items-center gap-1.5 rounded-lg bg-pearl px-2.5 py-1 text-[12.5px] font-semibold text-ink"><Wallet size={13} className="text-coral" /> {salaryText(r)}</span>
                {(r.employment || r.shift) && <span className="flex items-center gap-1.5 rounded-lg bg-pearl px-2.5 py-1 text-[12.5px] text-slate"><Clock size={13} className="text-coral" /> {[r.employment, r.shift].filter(Boolean).join(" · ")}</span>}
                {placeText(r) && <span className="flex items-center gap-1.5 rounded-lg bg-pearl px-2.5 py-1 text-[12.5px] text-slate">{r.work_mode === "Remote" ? <Home size={13} className="text-coral" /> : <MapPin size={13} className="text-coral" />} {placeText(r)}</span>}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 px-5">
                <Link href={`/roles/${r.slug}/applicants`} className="rounded-xl border border-shell px-3 py-2.5 hover:border-coral">
                  <div className="font-display text-[22px] leading-none font-extrabold text-lagoon">{r.applicants}</div>
                  <div className="mt-1 text-[11.5px] font-semibold text-slate">Applicants</div>
                </Link>
                <Link href={`/roles/${r.slug}/applicants`} className={`rounded-xl border px-3 py-2.5 hover:border-coral ${r.strong ? "border-seafoam-dark/25 bg-[#EEF8F3]" : "border-shell"}`}>
                  <div className={`font-display text-[22px] leading-none font-extrabold ${r.strong ? "text-seafoam-dark" : "text-silver"}`}>{r.strong}</div>
                  <div className="mt-1 text-[11.5px] font-semibold text-slate">Strong to review</div>
                </Link>
                <div className="rounded-xl border border-shell px-3 py-2.5">
                  <div className="font-display text-[22px] leading-none font-extrabold text-lagoon">{r.status === "open" ? r.fresh : "–"}</div>
                  <div className="mt-1 text-[11.5px] font-semibold text-slate">New this week</div>
                </div>
              </div>

              <div className="mt-4 px-5">
                <div className="flex justify-between text-[12px]">
                  <span className="font-semibold text-ink">{r.hired} of {r.openings} hired</span>
                  <span className={r.hired >= r.openings ? "font-semibold text-seafoam-dark" : "text-slate"}>{r.hired >= r.openings ? "All filled" : `${r.openings - r.hired} to go`}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-pearl">
                  <div className={`h-2 rounded-full ${r.hired >= r.openings ? "bg-seafoam-dark" : "bg-coral"}`} style={{ width: `${Math.max(filled, 0)}%` }} />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-1 border-t border-shell bg-pearl/60 px-3 py-2.5">
                <Link href={`/roles/${r.slug}`} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-lagoon hover:bg-white"><FileText size={14} /> Post & links</Link>
                <Link href={`/roles/${r.slug}/poster?from=roles`} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-lagoon hover:bg-white"><Palette size={14} /> Poster</Link>
                <Link href={`/roles/${r.slug}/applicants`} className="ml-auto flex items-center gap-1.5 rounded-lg bg-lagoon px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-coral"><Users size={14} /> Applicants</Link>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}
