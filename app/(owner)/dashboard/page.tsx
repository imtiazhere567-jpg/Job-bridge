import Link from "next/link";
import { ArrowRight, ArrowUpRight, Briefcase, CalendarClock, Inbox, Plus, ShieldCheck, Star } from "lucide-react";
import { Empty } from "@/components/ui";
import { SourcesCard, type SourceRow } from "@/components/sources-card";
import { BrandStar } from "@/components/logo";
import { db } from "@/lib/db";
import { ago, fmtDateTime } from "@/lib/format";
import { requireEmployer } from "@/lib/auth";

export const metadata = { title: "Overview" };

const PAST_SHORTLIST = "('shortlisted','invited','booked','interviewed','no_show','hired')";

export default async function Dashboard() {
  const { user, company } = await requireEmployer();
  const C = [company.id];
  const stats = (await db.one<{ open: number; week: number; review: number; upcoming: number; today: number }>(
    `select (select count(*)::int from roles where company_id = $1 and status = 'open') as open,
            (select count(*)::int from applicants a join roles r on r.id = a.role_id where r.company_id = $1 and a.created_at > now() - interval '7 days') as week,
            (select count(*)::int from applicants a join roles r on r.id = a.role_id where r.company_id = $1 and a.stage = 'applied' and a.band = 'strong' and r.status = 'open') as review,
            (select count(*)::int from interviews i join roles r on r.id = i.role_id where r.company_id = $1 and i.status = 'booked' and i.starts_at > now()) as upcoming,
            (select count(*)::int from interviews i join roles r on r.id = i.role_id where r.company_id = $1 and i.status = 'booked' and i.starts_at > now() and i.starts_at < now() + interval '24 hours') as today`,
    C,
  ))!;
  const roles = await db.q<{ id: number; slug: string; title: string; openings: number; applied: number; screened: number; shortlisted: number; interviewed: number; hired: number; strong: number; maybe: number; nofit: number }>(
    `select r.id, r.slug, r.title, r.openings,
       count(a.id)::int as applied,
       count(a.score)::int as screened,
       count(*) filter (where a.stage in ${PAST_SHORTLIST})::int as shortlisted,
       count(*) filter (where a.stage in ('interviewed','hired'))::int as interviewed,
       count(*) filter (where a.stage = 'hired')::int as hired,
       count(*) filter (where a.band = 'strong')::int as strong,
       count(*) filter (where a.band = 'maybe')::int as maybe,
       count(*) filter (where a.band = 'nofit')::int as nofit
     from roles r left join applicants a on a.role_id = r.id
     where r.company_id = $1 and r.status = 'open' group by r.id order by r.created_at desc`,
    C,
  );
  // Sources per job, so each job shows where its own applicants came from.
  const sourceRows = await db.q<SourceRow>("select a.role_id, a.source, count(*)::int as n from applicants a join roles r on r.id = a.role_id where r.company_id = $1 group by a.role_id, a.source", C);
  // Live and closed jobs (closed ones keep their numbers); drafts only once someone has applied.
  const sourceJobs = await db.q<{ id: number; title: string; status: string }>(
    "select r.id, r.title, r.status from roles r where r.company_id = $1 and (r.status <> 'draft' or exists (select 1 from applicants a where a.role_id = r.id)) order by (r.status = 'open') desc, (r.status = 'closed') desc, r.created_at desc",
    C,
  );
  const upcoming = await db.q<{ id: number; starts_at: string; name: string; title: string; applicant_id: number; slug: string }>(
    `select i.id, i.starts_at, a.name, r.title, a.id as applicant_id, a.slug from interviews i join applicants a on a.id = i.applicant_id join roles r on r.id = i.role_id
     where r.company_id = $1 and i.status = 'booked' and i.starts_at > now() order by i.starts_at limit 5`,
    C,
  );
  const activity = await db.q<{ text: string; created_at: string; applicant_id: number | null; slug: string | null }>("select x.text, x.created_at, x.applicant_id, a.slug from activity x left join applicants a on a.id = x.applicant_id where x.company_id = $1 order by x.created_at desc limit 7", C);
  const first = user.name.split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });

  const cards = [
    { label: "Open roles", value: stats.open, hint: "Live and taking applications", href: "/roles?status=open", Icon: Briefcase, tone: "bg-mint text-coral" },
    { label: "Applications", value: stats.week, hint: "In the last 7 days", href: "/applicants?recent=7", Icon: Inbox, tone: "bg-mint text-lagoon" },
    { label: "Strong fits to review", value: stats.review, hint: stats.review ? "Waiting for your shortlist" : "All caught up", href: "/applicants?band=strong&stage=applied", Icon: Star, tone: "bg-[#E3F4EC] text-seafoam-dark", highlight: stats.review > 0 },
    { label: "Upcoming interviews", value: stats.upcoming, hint: stats.today ? `${stats.today} in the next 24 hours` : "Booked by candidates", href: "/interviews", Icon: CalendarClock, tone: "bg-mint text-coral" },
  ];

  return (
    <>
      {/* Greeting banner */}
      <section className="bridge-gradient relative mb-6 overflow-clip rounded-[22px] p-6 text-white sm:p-8">
        <svg className="pointer-events-none absolute -right-10 -bottom-6 hidden sm:block" width="420" height="190" viewBox="0 0 420 190" aria-hidden="true">
          <path d="M10 190C80 20 340 20 410 190" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="40" />
          <path d="M100 190C140 90 280 90 320 190" fill="none" stroke="rgba(93,182,247,0.28)" strokeWidth="16" />
        </svg>
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[11.5px] font-bold tracking-[0.16em] text-[#5db6f7] uppercase">
              <BrandStar size={11} /> {today}
            </div>
            <h1 className="mt-2 font-display text-[28px] leading-tight font-extrabold sm:text-[34px]">Welcome back, {first}</h1>
            <p className="mt-2 max-w-xl text-[15px] text-white/75">
              {stats.review > 0
                ? `${stats.review} strong ${stats.review === 1 ? "applicant is" : "applicants are"} waiting for your shortlist.`
                : "You're all caught up. Post a job to start the next hire."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/roles/new" className="btn bg-white text-lagoon hover:bg-mint">
              <Plus size={16} /> New job
            </Link>
          </div>
        </div>
      </section>

      {/* Clickable stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, hint, href, Icon, tone, highlight }) => (
          <Link
            key={label}
            href={href}
            className={`group card flex flex-col p-5 hover:border-coral ${highlight ? "border-seafoam-dark/40 ring-1 ring-seafoam-dark/20" : ""}`}
          >
            <div className="flex items-start justify-between">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></span>
              <ArrowUpRight size={17} className="text-silver group-hover:text-coral" />
            </div>
            <div className="mt-4 font-display text-[34px] leading-none font-extrabold text-lagoon">{value}</div>
            <div className="mt-2 text-[13.5px] font-bold text-ink">{label}</div>
            <div className={`mt-0.5 text-[12.5px] ${highlight ? "font-semibold text-seafoam-dark" : "text-slate"}`}>{hint}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-extrabold text-lagoon">Hiring progress</h2>
            <Link href="/roles" className="text-[13px] font-semibold text-coral hover:underline">All jobs</Link>
          </div>
          {roles.length === 0 && (
            <Empty title="No live jobs yet">Click New job and the assistant writes the job post and poster for you.</Empty>
          )}
          {roles.map((r) => {
            const steps = [
              ["Applied", r.applied],
              ["Screened", r.screened],
              ["Shortlisted", r.shortlisted],
              ["Interviewed", r.interviewed],
              ["Hired", r.hired],
            ] as const;
            const max = Math.max(1, r.applied);
            const filled = Math.min(100, (r.hired / Math.max(1, r.openings)) * 100);
            return (
              <div key={r.id} className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/roles/${r.slug}?from=dashboard`} className="font-display text-lg font-extrabold text-ink hover:text-coral">{r.title}</Link>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold">
                      <span className="chip bg-[#E3F4EC] text-seafoam-dark">{r.strong} strong</span>
                      <span className="chip bg-amber-soft text-amber">{r.maybe} maybe</span>
                      <span className="chip bg-rust-soft text-rust">{r.nofit} not a fit</span>
                    </div>
                  </div>
                  <Link href={`/roles/${r.slug}/applicants?from=dashboard`} className="btn btn-ghost">
                    Applicants <ArrowRight size={15} />
                  </Link>
                </div>

                <div className="mt-6 space-y-2.5">
                  {steps.map(([label, n], i) => (
                    <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)_32px] items-center gap-3 text-[13px]">
                      <span className="text-slate">{label}</span>
                      <div className="h-2.5 rounded-full bg-pearl">
                        <div
                          className="h-2.5 rounded-full"
                          style={{ width: `${n ? Math.max(4, (n / max) * 100) : 0}%`, background: i === 4 ? "#0E7A4E" : i >= 2 ? "#063B67" : "#047CD3" }}
                        />
                      </div>
                      <span className="text-right font-display font-extrabold text-ink">{n}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-shell pt-4 text-[12.5px]">
                  <span className="font-semibold text-ink">{r.hired} of {r.openings} hired</span>
                  <div className="h-1.5 flex-1 rounded-full bg-pearl">
                    <div className="h-1.5 rounded-full bg-coral" style={{ width: `${filled}%` }} />
                  </div>
                  <span className="text-slate">{Math.max(0, r.openings - r.hired)} to go</span>
                </div>
              </div>
            );
          })}

          <SourcesCard jobs={sourceJobs} rows={sourceRows} />
        </section>

        <aside className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-ink">Next interviews</h2>
              <Link href="/interviews" className="text-[13px] font-semibold text-coral hover:underline">See all</Link>
            </div>
            <ul className="mt-4 space-y-2.5">
              {upcoming.map((u) => {
                const d = new Date(u.starts_at);
                return (
                  <li key={u.id}>
                    <Link href={`/applicants/${u.slug}?from=dashboard`} className="flex items-center gap-3 rounded-xl border border-shell p-3 hover:border-coral">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-lagoon text-center leading-none text-white">
                        <div>
                          <div className="font-display text-[17px] font-extrabold">{d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric" })}</div>
                          <div className="mt-0.5 text-[9.5px] font-bold tracking-wider text-[#5db6f7] uppercase">{d.toLocaleDateString("en-GB", { timeZone: "Europe/London", month: "short" })}</div>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-ink">{u.name}</div>
                        <div className="truncate text-[12px] text-slate">{fmtDateTime(u.starts_at)} · {u.title}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
              {upcoming.length === 0 && <li className="rounded-xl bg-pearl p-4 text-sm text-slate">No interviews booked yet. Shortlist candidates and they pick a time themselves.</li>}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="font-display text-lg font-extrabold text-ink">Recent activity</h2>
            <ul className="mt-4">
              {activity.map((a, i) => (
                <li key={i} className="relative flex gap-3 pb-4 text-sm last:pb-0">
                  {i < activity.length - 1 && <span className="absolute top-4 left-[4px] h-full w-px bg-shell" />}
                  <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-coral ring-1 ring-coral/30" />
                  <div className="min-w-0">
                    {a.slug ? <Link href={`/applicants/${a.slug}?from=dashboard`} className="text-ink hover:text-coral">{a.text}</Link> : <span className="text-ink">{a.text}</span>}
                    <div className="text-[12px] text-slate">{ago(a.created_at)}</div>
                  </div>
                </li>
              ))}
              {activity.length === 0 && <li className="text-sm text-slate">Nothing yet.</li>}
            </ul>
          </div>

          <div className="bridge-gradient rounded-[18px] p-6 text-white">
            <ShieldCheck size={20} className="text-[#5db6f7]" />
            <div className="mt-3 font-display text-lg font-extrabold">Fair hiring rule</div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/75">
              Applicants are scored only on skills, experience, availability and job answers. Age, gender, religion and ethnicity are never used, and nobody is rejected automatically. You make every decision.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
