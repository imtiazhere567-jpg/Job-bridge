import Link from "next/link";
import { Search } from "lucide-react";
import { ApplicantList, type Row } from "@/components/applicant-list";
import { HeroHeader } from "@/components/ui";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { ago, STAGE_LABEL } from "@/lib/format";
import { reject, shortlist } from "./actions";

export const metadata = { title: "Applicants" };

export default async function AllApplicants({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string; role?: string; band?: string; recent?: string }> }) {
  const { stage, q, role, band, recent } = await searchParams;
  const { company } = await requireEmployer();
  const roles = await db.q<{ id: number; title: string }>("select id, title from roles where company_id = $1 order by status = 'open' desc, created_at desc", [company.id]);
  const counts = await db.q<{ stage: string; n: number }>("select a.stage, count(*)::int as n from applicants a join roles r on r.id = a.role_id where r.company_id = $1 group by a.stage", [company.id]);
  const stats = (await db.one<{ total: number; strong: number; interviews: number; hired: number }>(
    `select count(*)::int as total,
            count(*) filter (where a.band = 'strong' and a.stage = 'applied')::int as strong,
            count(*) filter (where a.stage in ('invited','booked'))::int as interviews,
            count(*) filter (where a.stage = 'hired')::int as hired
     from applicants a join roles r on r.id = a.role_id where r.company_id = $1`,
    [company.id],
  ))!;
  const count = (s: string) => counts.find((c) => c.stage === s)?.n ?? 0;

  const args: unknown[] = [company.id];
  const where: string[] = ["r.company_id = $1"];
  if (stage && stage in STAGE_LABEL) where.push(`a.stage = $${args.push(stage)}`);
  if (band && ["strong", "maybe", "nofit"].includes(band)) where.push(`a.band = $${args.push(band)}`);
  const days = Math.min(90, Math.max(0, parseInt(recent ?? "", 10) || 0));
  if (days) where.push(`a.created_at > now() - make_interval(days => $${args.push(days)})`);
  if (role) where.push(`a.role_id = $${args.push(Number(role))}`);
  if (q) where.push(`(a.name ilike $${args.push(`%${q}%`)} or a.phone ilike $${args.length} or a.email ilike $${args.length})`);
  const rows = await db.q<Row & { created_at: string }>(
    `select a.id, a.slug, a.name, a.phone, a.city, a.source, a.score, a.band, a.stage, a.summary, a.duplicate_count, a.created_at, r.title as role_title
     from applicants a join roles r on r.id = a.role_id ${where.length ? `where ${where.join(" and ")}` : ""}
     order by a.score desc nulls last, a.created_at`,
    args,
  );
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ stage, q, role, band, recent, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/applicants${p.size ? `?${p}` : ""}`;
  };
  const extra = [band === "strong" ? "Strong fits only" : band === "maybe" ? "Maybe only" : band === "nofit" ? "Not a fit only" : null, days ? `Last ${days} days` : null].filter(Boolean);
  const tab = (active: boolean) => `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap ${active ? "bg-lagoon text-white" : "text-slate hover:bg-pearl hover:text-lagoon"}`;
  const badge = (active: boolean) => `rounded-full px-1.5 text-[11px] ${active ? "bg-white/20 text-white" : "bg-pearl text-slate"}`;

  return (
    <>
      <HeroHeader
        eyebrow="Applicants"
        title="Everyone in one place"
        sub="Applications from the website, the apply link, social media and email, scored fairly and with duplicates merged."
        stats={[
          { label: "Total applicants", value: stats.total },
          { label: "Strong fits waiting", value: stats.strong, tone: "green" },
          { label: "In interviews", value: stats.interviews, tone: "sky" },
          { label: "Hired", value: stats.hired, tone: "amber" },
        ]}
      />

      <div className="card mb-5 p-3">
        <div className="flex flex-wrap gap-1">
          <Link href={qs({ stage: undefined })} className={tab(!stage)}>
            All <span className={badge(!stage)}>{stats.total}</span>
          </Link>
          {Object.entries(STAGE_LABEL).map(([k, v]) => (
            <Link key={k} href={qs({ stage: k })} className={tab(stage === k)}>
              {v} <span className={badge(stage === k)}>{count(k)}</span>
            </Link>
          ))}
        </div>
        <form className="mt-2 flex flex-wrap gap-2 border-t border-shell pt-3" action="/applicants">
          {stage && <input type="hidden" name="stage" value={stage} />}
          {band && <input type="hidden" name="band" value={band} />}
          {recent && <input type="hidden" name="recent" value={recent} />}
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate" />
            <input name="q" defaultValue={q} placeholder="Search by name, phone or email" className="field py-2 pl-9 text-[13.5px]" />
          </div>
          <select name="role" defaultValue={role ?? ""} className="field w-auto py-2 text-[13.5px]">
            <option value="">All jobs</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <button className="btn btn-primary py-2">Search</button>
        </form>
        {extra.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-shell pt-3 text-[13px]">
            <span className="text-slate">Showing:</span>
            {extra.map((e) => <span key={e} className="chip border border-coral bg-mint text-lagoon">{e}</span>)}
            <Link href={qs({ band: undefined, recent: undefined })} className="font-semibold text-coral hover:underline">Clear</Link>
          </div>
        )}
      </div>

      <ApplicantList key={JSON.stringify({ stage, q, role, band, recent })} rows={rows.map((r) => ({ ...r, when: ago(r.created_at) }))} shortlist={shortlist} reject={reject} showRole from="applicants" />
    </>
  );
}
