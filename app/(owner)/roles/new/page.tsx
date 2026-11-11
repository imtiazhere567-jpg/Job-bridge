import Link from "next/link";
import { Copy, RotateCcw } from "lucide-react";
import { HeroHeader } from "@/components/ui";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/lib/types";
import { RoleForm } from "../role-form";
import { createRole } from "../actions";

export const metadata = { title: "New job" };

export default async function NewRole({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { company } = await requireEmployer();
  const { from } = await searchParams;
  const source = from ? await db.one<Role>(`select * from roles where ${/^\d+$/.test(from) ? "id = $1::int" : "slug = $1"} and company_id = $2`, [from, company.id]) : null;
  const saved = await db.q<{ id: number; slug: string; title: string }>("select id, slug, title from roles where company_id = $1 order by created_at desc limit 6", [company.id]);
  const role = source ? { ...source, start_date: null } : undefined;
  return (
    <>
      <HeroHeader
        eyebrow="New job"
        title={source ? `Hire another ${source.title}` : "What job are you hiring for?"}
        sub="Fill this in once, in about 5 minutes. The assistant writes the job post, social captions and screening questions, and makes a poster you can edit. It starts as a draft, so you can check everything before you publish."
      />
      {saved.length > 0 && (
        <div className="card mb-6 flex flex-wrap items-center gap-2 px-5 py-3.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink"><Copy size={14} className="text-coral" /> Start from a past job:</span>
          {saved.map((s) => (
            <Link key={s.id} href={`/roles/new?from=${s.slug}`} className={`rounded-xl border px-3 py-1.5 text-[13px] font-semibold ${source?.id === s.id ? "border-lagoon bg-lagoon text-white" : "border-shell bg-white text-lagoon hover:border-seafoam"}`}>
              {s.title}
            </Link>
          ))}
          {source && (
            <Link href="/roles/new" className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-slate hover:text-coral"><RotateCcw size={13} /> Start blank</Link>
          )}
        </div>
      )}
      <RoleForm key={from ?? "blank"} action={createRole} role={role} submitLabel="Create job, post & poster" />
    </>
  );
}
