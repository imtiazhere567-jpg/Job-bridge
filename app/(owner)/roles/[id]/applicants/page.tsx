import { ApplicantList, type Row } from "@/components/applicant-list";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleByParam } from "@/lib/owner";
import { backLink } from "@/lib/back";
import { ago } from "@/lib/format";
import { reject, shortlist } from "../../../applicants/actions";
import { RoleHeader } from "../tabs";
import { AddApplicant } from "./add-applicant";
import { addApplicant } from "../../../applicants/actions";

export const metadata = { title: "Applicants" };

export default async function RoleApplicants({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  const { company } = await requireEmployer();
  const role = await roleByParam(id, company.id, "/applicants");
  const rows = await db.q<Row & { created_at: string }>(
    "select id, slug, name, phone, city, source, score, band, stage, summary, duplicate_count, created_at from applicants where role_id = $1 order by score desc nulls last, created_at",
    [role.id],
  );
  const counts = { strong: 0, maybe: 0, nofit: 0 } as Record<string, number>;
  rows.forEach((r) => r.band && counts[r.band]++);
  return (
    <>
      <RoleHeader role={role} tab="applicants" counts={{ applicants: rows.length, hired: rows.filter((r) => r.stage === "hired").length }} back={await backLink(from, { href: "/roles", label: "All jobs" }, company.id)} from={from} />
      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[14px] bg-mint p-4"><div className="font-display text-3xl font-semibold text-seafoam-dark">{counts.strong}</div><div className="text-sm text-seafoam-dark">Strong fit</div></div>
          <div className="rounded-[14px] bg-amber-soft p-4"><div className="font-display text-3xl font-semibold text-amber">{counts.maybe}</div><div className="text-sm text-amber">Maybe</div></div>
          <div className="rounded-[14px] bg-rust-soft p-4"><div className="font-display text-3xl font-semibold text-rust">{counts.nofit}</div><div className="text-sm text-rust">Not a fit</div></div>
        </div>
        <AddApplicant action={addApplicant.bind(null, role.id)} />
      </div>
      <ApplicantList rows={rows.map((r) => ({ ...r, when: ago(r.created_at) }))} shortlist={shortlist} reject={reject} />
    </>
  );
}
