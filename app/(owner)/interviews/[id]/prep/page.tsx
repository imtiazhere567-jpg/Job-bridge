import Link from "next/link";
import { Check, X } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { PrintButton } from "./print";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewByParam, ownApplicant } from "@/lib/owner";
import { fmtDateTime } from "@/lib/format";
import { prepQuestions } from "@/lib/prep";
import { backLink } from "@/lib/back";

export const metadata = { title: "Prep sheet" };

export default async function Prep({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  const { company } = await requireEmployer();
  const own = await interviewByParam(id, company.id);
  const iv = (await db.one<{ applicant_id: number; role_id: number; starts_at: string | null }>("select applicant_id, role_id, starts_at from interviews where id = $1", [own.id]))!;
  const { a, r } = await ownApplicant(iv.applicant_id, company.id);
  const back = await backLink(from, { href: `/applicants/${a.slug}`, label: `Back to ${a.name}` }, company.id);
  const crit = a.breakdown?.criteria.filter((c) => c.kind !== "screening") ?? [];
  const questions = prepQuestions(a, r, company.name);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-between print:hidden">
        <Link href={back.href} className="text-[13px] font-semibold text-slate hover:text-lagoon">← {back.label}</Link>
        <PrintButton />
      </div>
      <article className="card p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between border-b border-shell pb-5">
          <div>
            <div className="eyebrow">Interview prep sheet</div>
            <h1 className="mt-1 font-display text-[28px] font-semibold text-lagoon">{a.name}</h1>
            <p className="text-sm text-slate">{r.title} · {iv.starts_at ? fmtDateTime(iv.starts_at) : "Not booked"} · Score {a.score ?? "–"}/100</p>
          </div>
          <LogoMark size={48} />
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-mint p-4"><div className="text-[12px] font-bold tracking-wider text-seafoam-dark uppercase">Strengths</div><p className="mt-1 text-sm">{a.summary?.strengths}</p></div>
          <div className="rounded-xl bg-amber-soft p-4"><div className="text-[12px] font-bold tracking-wider text-amber uppercase">Gaps</div><p className="mt-1 text-sm">{a.summary?.gaps}</p></div>
          <div className="rounded-xl bg-pearl p-4"><div className="text-[12px] font-bold tracking-wider text-lagoon uppercase">Focus on</div><p className="mt-1 text-sm">{a.summary?.ask}</p></div>
        </section>

        <section className="mt-7">
          <h2 className="font-display text-lg font-semibold text-ink">Questions to ask</h2>
          <p className="mt-0.5 text-[13px] text-slate">Picked for {a.name.split(" ")[0]} and this job. Write short notes in the boxes as you go.</p>
          <ol className="mt-4 space-y-5">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-3 break-inside-avoid">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lagoon text-[12px] font-bold text-white">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-ink">{q.q}</p>
                  <p className="mt-1 text-[12.5px] text-slate"><span className="font-bold text-coral">Listen for:</span> {q.listen}</p>
                  <div className="mt-2 h-14 rounded-lg border border-dashed border-shell" />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-7">
          <h2 className="font-display text-lg font-semibold text-ink">Against the role profile</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {crit.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {c.met ? <Check size={15} className="mt-0.5 text-seafoam-dark" /> : <X size={15} className="mt-0.5 text-rust" />}
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-7">
          <h2 className="font-display text-lg font-semibold text-ink">Their screening answers</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {a.answers.map((x) => (
              <div key={x.id}><dt className="text-slate">{x.question}</dt><dd className="font-medium">{x.answer || "–"}</dd></div>
            ))}
          </dl>
        </section>
      </article>
    </div>
  );
}
