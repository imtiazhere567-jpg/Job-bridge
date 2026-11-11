import Link from "next/link";
import { AlertTriangle, ArrowLeft, Briefcase, CalendarClock, Check, Download, ExternalLink, FileText, GraduationCap, Mail, MapPin, MessageCircleQuestion, Phone, RefreshCw, Share2, ThumbsUp, X } from "lucide-react";
import { Submit } from "@/components/client";
import { Avatar, BandChip, ScoreRing, StageChip, WhatsAppLink } from "@/components/ui";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { applicantByParam } from "@/lib/owner";
import { backLink } from "@/lib/back";
import { BAND_LABEL, fmtDateTime, SOURCES, waLink } from "@/lib/format";
import { WEIGHTS } from "@/lib/scoring";
import { markAttended, markHired, markNoShow, reject, rescoreOne, saveNotes, shortlist } from "../actions";

export const metadata = { title: "Applicant" };

const KIND_LABEL = { must: "Must-have", language: "Language", experience: "Experience", nice: "Nice-to-have", screening: "Screening" } as const;
const STEPS = ["Applied", "Shortlisted", "Booking link sent", "Interview booked", "Interviewed", "Hired"];
const STEP_OF: Record<string, number> = { applied: 0, shortlisted: 1, invited: 2, booked: 3, interviewed: 4, no_show: 4, hired: 5 };
const VERDICT = { strong: "Matches the job well. A good one to meet.", maybe: "Matches part of the job. Worth a closer look.", nofit: "Misses key requirements for this job." } as const;

export default async function ApplicantPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  const { company } = await requireEmployer();
  const { a, r: role } = await applicantByParam(id, company.id);
  // Back to wherever the owner came from (Interviews, Applicants, Overview…), else this job's applicants.
  const back = await backLink(from, { href: `/roles/${role.slug}/applicants`, label: `${role.title} applicants` }, company.id);
  const hiredSoFar = (await db.one<{ n: number }>("select count(*)::int as n from applicants where role_id = $1 and stage = 'hired'", [role.id]))!.n;
  const interviews = await db.q<{ id: number; status: string; starts_at: string | null; token: string; created_at: string }>("select * from interviews where applicant_id = $1 order by created_at desc", [a.id]);
  const messages = await db.q<{ id: number; channel: string; kind: string; direction: string; subject: string | null; body: string; created_at: string }>(
    "select id, channel, kind, direction, subject, body, created_at from messages where applicant_id = $1 order by created_at desc, id desc limit 12",
    [a.id],
  );
  const live = interviews.find((i) => i.status === "booked" || i.status === "invited");
  const idForm = (fn: (f: FormData) => Promise<void>) => async () => {
    "use server";
    const f = new FormData();
    f.append("ids", String(a.id));
    await fn(f);
  };
  const b = a.breakdown;
  const step = a.stage === "hired" ? STEPS.length : STEP_OF[a.stage] ?? 0; // hired: every step is done
  const rejected = a.stage === "rejected";
  const firstInvite = interviews.length ? interviews[interviews.length - 1] : null;
  const bookedIv = interviews.find((i) => i.starts_at && i.status !== "cancelled");
  const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
  // A date under the steps we know the time of.
  const stepNote: (string | null)[] = [
    short(a.created_at),
    null,
    firstInvite ? short(firstInvite.created_at) : null,
    bookedIv?.starts_at ? fmtDateTime(bookedIv.starts_at) : null,
    null,
    null,
  ];
  const hasCv = !!(a.cv_data || a.cv_text?.trim());
  const cvKind = a.cv_file === ".pdf" ? "PDF" : a.cv_file === ".docx" ? "Word document" : a.cv_data ? "File" : "CV";
  // Everything the applicant typed into the apply form, for the "Application form" card.
  const screening = a.answers.filter((x) => !x.id.startsWith("f_"));
  const extras = a.answers.filter((x) => x.id.startsWith("f_") && x.answer);
  const fromForm = a.answers.length > 0;
  const formRows: { label: string; value: string; href?: string; external?: boolean; muted?: boolean }[] = [
    { label: "Full name", value: a.name },
    { label: "Phone / WhatsApp", value: a.phone ?? "Not given", href: a.phone ? waLink(a.phone) ?? `tel:${a.phone}` : undefined, external: true, muted: !a.phone },
    { label: "Email", value: a.email ?? "Not given", href: a.email ? `mailto:${a.email}` : undefined, muted: !a.email },
    { label: "City / area", value: a.city ?? "Not given", muted: !a.city },
    { label: "CV", value: hasCv ? (a.cv_name ?? "CV") : "Not uploaded", href: hasCv ? `/applicants/${a.slug}/cv` : undefined, external: true, muted: !hasCv },
    ...extras.map((x) => ({ label: x.question, value: x.answer, href: /^https?:\/\//i.test(x.answer) ? x.answer : undefined, external: true })),
    { label: "Applied via", value: SOURCES[a.source] ?? a.source },
    { label: "Applied on", value: fmtDateTime(a.created_at) },
    ...(fromForm ? [{ label: "Consent", value: "Agreed to store their application and be contacted" }] : []),
  ];
  const contact = [
    a.phone && { icon: Phone, label: "Phone / WhatsApp", value: a.phone, href: waLink(a.phone) ?? `tel:${a.phone}`, green: true },
    a.email && { icon: Mail, label: "Email", value: a.email, href: `mailto:${a.email}` },
    a.city && { icon: MapPin, label: "City", value: a.city },
    { icon: Share2, label: "Applied via", value: SOURCES[a.source] ?? a.source },
    { icon: CalendarClock, label: "Applied on", value: fmtDateTime(a.created_at) },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string; green?: boolean }[];

  return (
    <>
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-lagoon">
        <ArrowLeft size={14} /> {back.label}
      </Link>

      {/* Profile header: brand cover with the photo-style badge overlapping it */}
      <section className="card mt-4 overflow-hidden">
        <div className="bridge-gradient relative h-28">
          <svg className="pointer-events-none absolute right-0 bottom-0" width="460" height="112" viewBox="0 0 460 112" aria-hidden="true">
            <path d="M60 112C130 10 330 10 400 112" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="34" />
            <path d="M170 112C205 52 285 52 320 112" fill="none" stroke="rgba(93,182,247,0.3)" strokeWidth="14" />
          </svg>
        </div>
        <div className="px-6 pb-6 sm:px-8">
          <div className="relative z-[1] -mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="rounded-full bg-white p-1.5 shadow-sm"><Avatar name={a.name} size={92} /></div>
            <div className="flex flex-wrap gap-2 pb-1">
              <WhatsAppLink phone={a.phone} text={`Hi ${a.name.split(" ")[0]}, this is ${company.sign_as ?? company.name} about your application for ${role.title}.`} label="Chat on WhatsApp" />
              {(a.stage === "applied" || a.stage === "rejected") && role.status === "open" && (
                <form action={idForm(shortlist)}><Submit className="btn btn-primary" pendingText="Inviting…"><Check size={15} /> Shortlist & send booking link</Submit></form>
              )}
              {["interviewed", "booked", "shortlisted", "invited"].includes(a.stage) && (
                <form action={markHired.bind(null, a.id)}><Submit className="btn btn-primary" confirm={`Mark ${a.name} as hired? They get a congratulations message.${hiredSoFar + 1 >= role.openings ? ` This fills the last of ${role.openings} position(s), so the job will close automatically.` : ""}`}>Mark as hired</Submit></form>
              )}
              {a.stage !== "rejected" && a.stage !== "hired" && (
                <form action={idForm(reject)}><Submit className="btn btn-ghost" confirm={`Send ${a.name} a polite "not selected" message?`}><X size={15} /> Not selected</Submit></form>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h1 className="font-display text-[28px] leading-tight font-extrabold text-ink">{a.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-slate">
              <span className="flex items-center gap-1.5"><Briefcase size={14} className="text-coral" /> Applied for <Link href={`/roles/${role.slug}?from=applicant:${a.slug}`} className="font-semibold text-lagoon hover:text-coral">{role.title}</Link></span>
              <span className="text-shell">|</span>
              <BandChip band={a.band} />
              <StageChip stage={a.stage} />
              {a.duplicate_count > 0 && <span className="chip border border-shell bg-pearl text-slate">Applied {a.duplicate_count + 1}× (merged)</span>}
            </div>
          </div>

          {/* Boxes stretch to fill the row, so there are never empty grey slots when some details are missing. */}
          {(a.stage === "applied" || a.stage === "rejected") && role.status !== "open" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3 text-[13.5px] text-ink">
              <span className="flex-1">
                <b>{role.status === "closed" ? (role.closed_reason === "filled" ? "This job is filled and closed." : "This job is closed.") : "This job is still a draft."}</b>{" "}
                {role.status === "draft"
                  ? "Publish it first, then you can shortlist and invite applicants."
                  : hiredSoFar >= role.openings
                    ? `Interview invites can't be sent for a closed job. To hire more, edit the job, raise the number of people (now ${role.openings}), then reopen it.`
                    : "Interview invites can't be sent for a closed job. Reopen it to shortlist and invite more people."}
              </span>
              <Link href={role.status === "closed" && hiredSoFar >= role.openings ? `/roles/${role.slug}/edit` : `/roles/${role.slug}`} className="btn btn-ghost bg-white px-3.5 py-1.5 text-[13px]">
                {role.status === "draft" ? "Go to job to publish" : hiredSoFar >= role.openings ? "Edit job" : "Go to job to reopen"}
              </Link>
            </div>
          )}

          <dl className="mt-5 flex flex-wrap gap-px overflow-hidden rounded-2xl border border-shell bg-shell">
            {contact.map((c) => (
              <div key={c.label} className="min-w-[170px] flex-1 bg-white px-4 py-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate uppercase"><c.icon size={12} className="text-coral" /> {c.label}</dt>
                <dd className="mt-1 truncate text-[13.5px] font-semibold">
                  {c.href ? <a href={c.href} target="_blank" rel="noopener noreferrer" className={c.green ? "text-[#128C4B] hover:underline" : "text-ink hover:text-coral"}>{c.value}</a> : <span className="text-ink">{c.value}</span>}
                </dd>
              </div>
            ))}
          </dl>

          {/* Hiring steps on one connected line */}
          <div className="mt-6">
            {rejected ? (
              <div className="flex items-center gap-2 rounded-xl bg-rust-soft px-4 py-3 text-[13.5px] font-semibold text-rust"><X size={15} /> Marked as not selected. A polite message was sent.</div>
            ) : (
              <ol className="flex items-start">
                {STEPS.map((s, i) => {
                  const done = i < step;
                  const now = i === step;
                  return (
                    <li key={s} className="relative flex min-w-0 flex-1 flex-col items-center px-1 text-center">
                      {i > 0 && <span className={`absolute top-[13px] right-1/2 h-[3px] w-full ${i <= step ? "bg-seafoam-dark" : "bg-shell"}`} />}
                      <span className={`relative z-[1] grid h-7 w-7 place-items-center rounded-full text-[12px] font-extrabold ${done ? "bg-seafoam-dark text-white" : now ? "bg-coral text-white ring-4 ring-coral/20" : "border-2 border-shell bg-white text-silver"}`}>
                        {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={`mt-2 text-[12px] leading-tight font-semibold ${done ? "text-seafoam-dark" : now ? "text-lagoon" : "text-silver"}`}>{s}</span>
                      {(done || now) && stepNote[i] && <span className="mt-0.5 text-[11px] leading-tight text-slate">{stepNote[i]}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Fit for the job */}
          {(a.summary || b) && (
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-shell px-6 py-4">
                <h2 className="font-display text-[17px] font-extrabold text-lagoon">Fit for the job</h2>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-slate">Scored by {a.scored_by === "claude" ? "Claude" : "the rules engine"}</span>
                  <form action={rescoreOne.bind(null, a.id)}><Submit className="flex items-center gap-1 rounded-full border border-shell px-3 py-1 text-[12.5px] font-semibold text-lagoon hover:border-coral" pendingText="Re-reading…"><RefreshCw size={12} /> Re-score</Submit></form>
                </div>
              </div>

              <div className="grid gap-6 p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                <div className="flex flex-col items-center text-center">
                  <ScoreRing score={a.score} band={a.band} size={112} />
                  <div className="mt-2 font-display text-[15px] font-extrabold text-ink">{a.band ? BAND_LABEL[a.band] : "Not scored"}</div>
                  <div className="max-w-[170px] text-[12px] text-slate">{a.band ? VERDICT[a.band] : ""}</div>
                </div>
                {b && (
                  <div className="space-y-3">
                    {([["Must-have skills", b.must, WEIGHTS.must], ["Experience", b.experience, WEIGHTS.experience], ["Nice-to-haves", b.nice, WEIGHTS.nice], ["Screening answers", b.screening, WEIGHTS.screening]] as const).map(([l, v, max]) => (
                      <div key={l}>
                        <div className="flex justify-between text-[13px]">
                          <span className="font-semibold text-ink">{l}</span>
                          <span className="font-display font-extrabold text-lagoon">{v}<span className="text-[11.5px] font-semibold text-slate"> / {max}</span></span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-pearl"><div className={`h-2 rounded-full ${v >= max ? "bg-seafoam-dark" : v >= max / 2 ? "bg-coral" : "bg-amber"}`} style={{ width: `${(v / max) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {a.summary && (
                <div className="grid border-t border-shell bg-pearl/50 sm:grid-cols-3 sm:divide-x sm:divide-shell">
                  <Note icon={<ThumbsUp size={15} />} tone="text-seafoam-dark bg-[#E3F4EC]" label="Strengths" text={a.summary.strengths} />
                  <Note icon={<AlertTriangle size={15} />} tone="text-amber bg-amber-soft" label="Gaps" text={a.summary.gaps} />
                  <Note icon={<MessageCircleQuestion size={15} />} tone="text-coral bg-mint" label="Ask in the interview" text={a.summary.ask} />
                </div>
              )}
            </section>
          )}

          {/* What was checked */}
          {b && (
            <section className="card overflow-hidden">
              <div className="border-b border-shell px-6 py-4">
                <h2 className="font-display text-[17px] font-extrabold text-lagoon">What was checked</h2>
                <p className="text-[12.5px] text-slate">Only job-related points. Age, gender, religion and other personal details are never used.</p>
              </div>
              <ul className="divide-y divide-shell">
                {b.criteria.filter((c) => c.kind !== "screening").map((c, i) => (
                  <li key={i} className="flex items-start gap-3 px-6 py-3">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.met ? "bg-seafoam-dark text-white" : "bg-rust text-white"}`}>
                      {c.met ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-bold text-ink">{c.label}</span>
                        <span className="rounded-md bg-pearl px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-slate uppercase">{KIND_LABEL[c.kind]}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-slate">{c.evidence}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Screening answers */}
          <section className="card overflow-hidden">
            <div className="border-b border-shell px-6 py-4">
              <h2 className="font-display text-[17px] font-extrabold text-lagoon">Screening answers</h2>
            </div>
            {screening.length === 0 && <p className="px-6 py-4 text-sm text-slate">{fromForm ? "No screening questions for this job." : "No answers (CV added by you)."}</p>}
            <ul className="divide-y divide-shell">
              {screening.map((x) => {
                const yes = /^yes$/i.test(x.answer);
                const no = /^no$/i.test(x.answer);
                return (
                  <li key={x.id} className="px-6 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[13.5px] text-ink">{x.question}</span>
                      {(yes || no) && <span className={`chip shrink-0 ${yes ? "bg-[#E3F4EC] text-seafoam-dark" : "bg-rust-soft text-rust"}`}>{yes ? <Check size={12} /> : <X size={12} />} {yes ? "Yes" : "No"}</span>}
                    </div>
                    {!yes && !no && <p className="mt-2 rounded-xl bg-pearl px-3.5 py-2.5 text-[13.5px] text-ink">{x.answer || <span className="text-slate italic">No answer</span>}</p>}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* CV */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-shell px-6 py-4">
              <h2 className="font-display text-[17px] font-extrabold text-lagoon">CV</h2>
              {a.cv_data && <a href={`/applicants/${a.slug}/cv?download=1`} className="btn btn-ghost px-3 py-1.5 text-[13px]"><Download size={13} /> Download</a>}
            </div>
            <div className="p-6">
              {hasCv ? (
                <a href={`/applicants/${a.slug}/cv`} target="_blank" rel="noopener" className="group mb-6 flex items-center gap-4 rounded-2xl border border-shell bg-pearl/60 p-4 hover:border-coral hover:bg-white">
                  <span className="grid h-12 w-10 shrink-0 place-items-center rounded-lg bg-lagoon text-white shadow-[0_6px_14px_rgba(6,59,103,0.25)]"><FileText size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-ink">{a.cv_name ?? `${a.name} CV`}</span>
                    <span className="block text-[12.5px] text-slate">{cvKind} · opens in a new tab</span>
                  </span>
                  <span className="btn btn-primary shrink-0 px-4 py-2 text-[13px]"><ExternalLink size={14} /> Open CV</span>
                </a>
              ) : (
                <p className="mb-6 rounded-xl bg-pearl px-4 py-3 text-[13px] text-slate">No CV was uploaded with this application.</p>
              )}
              {a.parsed && (
                <div className="space-y-5">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-slate uppercase"><Briefcase size={13} className="text-coral" /> Experience · about {a.parsed.years_experience} yr</div>
                      <ul className="space-y-1.5 text-[13.5px] text-ink">{a.parsed.experience.length ? a.parsed.experience.map((e, i) => <li key={i}>{e.replace(/^[-•]\s*/, "")}</li>) : <li className="text-slate">None found</li>}</ul>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-slate uppercase"><GraduationCap size={13} className="text-coral" /> Education</div>
                      <ul className="space-y-1.5 text-[13.5px] text-ink">{a.parsed.education.length ? a.parsed.education.map((e, i) => <li key={i}>{e.replace(/^[-•]\s*/, "")}</li>) : <li className="text-slate">None found</li>}</ul>
                    </div>
                  </div>
                  {a.parsed.skills.length > 0 && (
                    <div>
                      <div className="mb-2 text-[12px] font-bold tracking-wide text-slate uppercase">Skills</div>
                      <div className="flex flex-wrap gap-1.5">{a.parsed.skills.map((s, i) => <span key={i} className="chip bg-mint text-lagoon">{s}</span>)}</div>
                    </div>
                  )}
                </div>
              )}
              {a.cv_text && (
                <details className="mt-5 rounded-xl border border-shell">
                  <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-semibold text-lagoon">Show full CV text</summary>
                  <pre className="max-h-96 overflow-auto px-4 pb-4 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{a.cv_text}</pre>
                </details>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          {/* Interview */}
          <section className="card overflow-hidden">
            <div className="border-b border-shell px-6 py-4"><h2 className="font-display text-[17px] font-extrabold text-lagoon">Interview</h2></div>
            <div className="p-6">
              {interviews.length === 0 && <p className="text-sm text-slate">Not invited yet. Shortlist to send a booking link.</p>}
              <ul className="space-y-3">
                {interviews.map((iv) => {
                  const tone = iv.status === "completed" ? "bg-[#E3F4EC] text-seafoam-dark" : iv.status === "no_show" ? "bg-rust-soft text-rust" : iv.status === "booked" ? "bg-mint text-lagoon" : "bg-pearl text-slate";
                  const label = { completed: "Attended", no_show: "No-show", booked: "Booked", invited: "Waiting to book", cancelled: "Cancelled" }[iv.status] ?? iv.status;
                  const d = iv.starts_at ? new Date(iv.starts_at) : null;
                  return (
                    <li key={iv.id}>
                      <div className="flex items-center gap-3">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-lagoon text-center leading-none text-white">
                          {d ? (
                            <div>
                              <div className="font-display text-[20px] font-extrabold">{d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric" })}</div>
                              <div className="mt-0.5 text-[10px] font-bold tracking-wider text-[#5db6f7] uppercase">{d.toLocaleDateString("en-GB", { timeZone: "Europe/London", month: "short" })}</div>
                            </div>
                          ) : <CalendarClock size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-bold text-ink">{iv.starts_at ? fmtDateTime(iv.starts_at) : "No time picked yet"}</div>
                          <span className={`chip mt-1 ${tone}`}>{label}</span>
                        </div>
                      </div>
                      {iv.status === "booked" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link href={`/interviews/${a.slug}/prep`} className="btn btn-ghost px-3 py-1.5 text-[13px]">Prep sheet</Link>
                          <form action={markAttended.bind(null, iv.id)}><Submit className="btn btn-primary px-3 py-1.5 text-[13px]">Attended</Submit></form>
                          <form action={markNoShow.bind(null, iv.id)}><Submit className="btn btn-ghost px-3 py-1.5 text-[13px]" confirm="Mark as no-show? One polite follow-up with a rebooking link will be sent.">No-show</Submit></form>
                        </div>
                      )}
                      {iv.status === "invited" && <div className="mt-2 font-mono text-[11.5px] break-all text-slate">/book/{iv.token}</div>}
                    </li>
                  );
                })}
              </ul>
              {live && !live.starts_at && <p className="mt-3 text-[12.5px] text-slate">They received a link showing only your free interview slots.</p>}
            </div>
          </section>

          {/* Notes */}
          <section className="card overflow-hidden">
            <div className="border-b border-shell px-6 py-4"><h2 className="font-display text-[17px] font-extrabold text-lagoon">Your private notes</h2></div>
            <form action={saveNotes.bind(null, a.id)} className="space-y-2 p-6">
              <textarea name="notes" rows={4} defaultValue={a.owner_notes ?? ""} className="field text-sm" placeholder="Only you can see this." />
              <Submit className="btn btn-ghost" pendingText="Saving…">Save notes</Submit>
            </form>
          </section>

          {/* Messages */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-shell px-6 py-4">
              <h2 className="font-display text-[17px] font-extrabold text-lagoon">Messages</h2>
              {messages.length > 0 && <Link href={`/messages?a=${a.slug}`} className="text-[13px] font-semibold text-coral hover:underline">Open chat</Link>}
            </div>
            <ul className="p-6">
              {messages.map((m, i) => {
                const inbound = m.direction !== "out";
                const text = m.subject || m.body.replace(/\s+/g, " ").slice(0, 90);
                return (
                  <li key={m.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < messages.length - 1 && <span className="absolute top-6 left-[11px] h-full w-px bg-shell" />}
                    <span className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${m.channel === "whatsapp" ? "bg-[#25D366]" : "bg-coral"}`}>
                      {m.channel === "whatsapp" ? <Phone size={11} /> : <Mail size={11} />}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/messages?a=${a.slug}`} className="line-clamp-2 text-[13.5px] text-ink hover:text-coral">{text}</Link>
                      <div className="text-[11.5px] text-slate">{inbound ? "From applicant" : "Sent"} · {m.channel === "whatsapp" ? "WhatsApp" : "Email"} · {fmtDateTime(m.created_at)}</div>
                    </div>
                  </li>
                );
              })}
              {messages.length === 0 && <li className="text-sm text-slate">None yet.</li>}
            </ul>
          </section>

          {/* Everything they filled in */}
          <section className="card overflow-hidden">
            <div className="border-b border-shell px-6 py-4">
              <h2 className="font-display text-[17px] font-extrabold text-lagoon">Application form</h2>
              <p className="mt-0.5 text-[12.5px] text-slate">{fromForm ? "Everything they filled in when applying." : "Added by you from a CV."}</p>
            </div>
            <dl className="divide-y divide-shell">
              {formRows.map((r) => {
                const yes = /^yes$/i.test(r.value);
                const no = /^no$/i.test(r.value);
                return (
                  <div key={r.label} className="px-6 py-3">
                    <dt className="text-[11px] font-bold tracking-wider text-slate uppercase">{r.label}</dt>
                    <dd className={`mt-0.5 text-[13.5px] break-words ${r.muted ? "text-silver italic" : "text-ink"}`}>
                      {yes || no ? (
                        <span className={`chip ${yes ? "bg-[#E3F4EC] text-seafoam-dark" : "bg-rust-soft text-rust"}`}>{yes ? <Check size={12} /> : <X size={12} />} {yes ? "Yes" : "No"}</span>
                      ) : r.href ? (
                        <a href={r.href} {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="font-semibold text-lagoon hover:text-coral">{r.value}</a>
                      ) : (
                        <span className="whitespace-pre-line">{r.value}</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function Note({ icon, tone, label, text }: { icon: React.ReactNode; tone: string; label: string; text: string }) {
  return (
    <div className="border-b border-shell p-5 last:border-b-0 sm:border-b-0">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${tone}`}>{icon}</span>
        <span className="text-[12.5px] font-extrabold text-ink">{label}</span>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-slate">{text}</p>
    </div>
  );
}
