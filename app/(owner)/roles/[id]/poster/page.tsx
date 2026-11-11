import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { BrandStar } from "@/components/logo";
import { PosterEditor } from "@/components/poster-editor/editor";
import type { DesignId, PosterContent, SizeId } from "@/components/poster-editor/build";
import { RoleStatusChip } from "@/components/ui";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { placeText, salaryText } from "@/lib/jobpost";
import { baseUrl } from "@/lib/messages";
import { backLink } from "@/lib/back";
import { roleByParam } from "@/lib/owner";
import { baseCopy, brandOf } from "@/lib/poster";
import { removePosterEdit, savePosterEdit, syncPosterTextEdit } from "../../actions";

export const metadata = { title: "Poster editor" };

export default async function PosterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  const { company } = await requireEmployer();
  const role = await roleByParam(id, company.id, "/poster");
  const back = await backLink(from, { href: `/roles/${role.slug}`, label: role.title }, company.id);
  const brand = brandOf(company);
  const copy = baseCopy(role, brand);
  const short = `${baseUrl()}/apply/${role.slug}`;
  const requirements = [
    ...role.must_have.map((m) => (/^(experience|knowledge|ability|good|strong|basic|fluent|proven)/i.test(m) ? m : `Experience with ${/^[A-Z][a-z]/.test(m) ? m.charAt(0).toLowerCase() + m.slice(1) : m}`)),
    role.min_experience > 0 ? `At least ${role.min_experience} year${role.min_experience > 1 ? "s" : ""} of relevant experience` : "",
    role.languages.length ? `Comfortable in ${role.languages.join(" and ")}` : "",
  ].filter(Boolean).slice(0, 5);
  const content: PosterContent = {
    kicker: "We're",
    headline: copy.headline,
    tagline: copy.tagline,
    label: copy.label,
    title: role.title,
    intro: copy.intro,
    points: copy.points,
    requirements,
    cta: copy.cta,
    contact: copy.contact,
    footer: copy.footer,
    workMode: role.work_mode,
    salary: salaryText(role, true),
    place: role.work_mode === "Remote" ? "Remote (work from home)" : placeText(role) || company.city || "",
    link: short.replace(/^https?:\/\//, ""),
    qr: await QRCode.toDataURL(`${short}?src=poster`, { margin: 1, width: 360, color: { dark: "#0C1B2E", light: "#FFFFFF" } }),
  };
  const rows = await db.q<{ size: SizeId; design: DesignId; doc: unknown }>("select size, design, doc from poster_images where role_id = $1", [role.id]);
  // Layers go to the browser as text: deeply nested JSON is refused by the page data transfer.
  const saved = Object.fromEntries(rows.map((r) => [r.size, { doc: JSON.stringify(r.doc), design: r.design }]));

  return (
    <>
      <section className="bridge-gradient relative mb-5 overflow-clip rounded-[22px] px-6 py-5 text-white sm:px-8">
        <svg className="pointer-events-none absolute -right-10 -bottom-6 hidden sm:block" width="420" height="160" viewBox="0 0 420 160" aria-hidden="true">
          <path d="M10 160C80 10 340 10 410 160" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="40" />
        </svg>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href={back.href} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 hover:text-white"><ArrowLeft size={14} /> {back.label}</Link>
            <div className="mt-2 flex items-center gap-2 text-[11.5px] font-bold tracking-[0.16em] text-[#5db6f7] uppercase"><BrandStar size={11} /> Poster editor</div>
            <h1 className="mt-1 font-display text-[26px] leading-tight font-extrabold">Design the poster for {role.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RoleStatusChip status={role.status} reason={role.closed_reason} />
          </div>
        </div>
      </section>
      <PosterEditor
        content={content}
        brand={{ primary: brand.primary, accent: brand.accent }}
        saved={saved}
        // Posters saved before links had the job name show the old short link; swap it for the new one.
        textEdits={[...(role.poster_texts ?? []), [`${baseUrl()}/j/${role.code}`.replace(/^https?:\/\//, ""), content.link] as [string, string]]}
        save={savePosterEdit.bind(null, role.id)}
        remove={removePosterEdit.bind(null, role.id)}
        syncText={syncPosterTextEdit.bind(null, role.id)}
      />
    </>
  );
}
