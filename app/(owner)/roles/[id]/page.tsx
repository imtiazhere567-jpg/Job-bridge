import Link from "next/link";
import { JobDescription } from "@/components/job-description";
import type { ReactNode } from "react";
import { Check, Download, Eye, Megaphone, Palette, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { CopyButton, EditableText, Submit } from "@/components/client";
import { Notice } from "@/components/ui";
import { SourcesCard, type SourceRow } from "@/components/sources-card";
import { FormFieldsEditor } from "@/components/form-fields-editor";
import { ScrollTop } from "@/components/back-button";
import { ScreeningEditor } from "@/components/screening-editor";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { backLink } from "@/lib/back";
import { aiEnabled } from "@/lib/ai";

import { baseUrl } from "@/lib/messages";
import { roleByParam } from "@/lib/owner";
import { notifyRemaining, regeneratePost, saveFormFields, savePost, saveScreening } from "../actions";
import { RoleHeader } from "./tabs";

export const metadata = { title: "Post, poster & sharing" };

const CHANNELS = [
  { field: "post_facebook", label: "Facebook", src: "facebook", color: "#1F4E8C" },
  { field: "post_instagram", label: "Instagram", src: "instagram", color: "#B5476B" },
  { field: "post_whatsapp", label: "WhatsApp", src: "whatsapp", color: "#2E7D4F" },
  { field: "post_linkedin", label: "LinkedIn", src: "linkedin", color: "#24577A" },
] as const;

const POSTERS = [
  { size: "portrait", label: "Instagram post", dims: "1080 × 1350", ratio: "4:5", box: "h-11 w-9" },
  { size: "square", label: "Facebook square", dims: "1080 × 1080", ratio: "1:1", box: "h-10 w-10" },
  { size: "linkedin", label: "LinkedIn", dims: "1200 × 627", ratio: "1.91:1", box: "h-8 w-[60px]" },
  { size: "story", label: "WhatsApp Status", dims: "1080 × 1920", ratio: "9:16", box: "h-12 w-[30px]" },
] as const;

/** One numbered step of the job page, joined to the next by a line. */
function Step({ n, title, sub, right, last, children }: { n: number; title: string; sub?: string; right?: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <section className="relative pb-10 pl-12 sm:pl-14">
      {!last && <span aria-hidden="true" className="absolute top-11 bottom-1 left-[17px] w-0.5 rounded-full bg-shell sm:left-[19px]" />}
      <span className="absolute top-0 left-0 grid h-9 w-9 place-items-center rounded-full bg-lagoon font-display text-[15px] font-extrabold text-white shadow-[0_6px_16px_rgba(6,59,103,0.25)] sm:h-10 sm:w-10">{n}</span>
      <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3 sm:min-h-10">
        <div className="min-w-0">
          <h2 className="font-display text-[20px] leading-tight font-extrabold text-lagoon">{title}</h2>
          {sub && <p className="mt-0.5 text-[13.5px] text-slate">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default async function RolePost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; rewritten?: string; saved?: string; from?: string }> }) {
  const { id } = await params;
  const { created, rewritten, saved, from } = await searchParams;
  const ai = aiEnabled();
  const { company } = await requireEmployer();
  const role = await roleByParam(id, company.id, "");
  const counts = (await db.one<{ applicants: number; hired: number; waiting: number }>(
    "select count(*)::int as applicants, count(*) filter (where stage = 'hired')::int as hired, count(*) filter (where stage not in ('hired','rejected'))::int as waiting from applicants where role_id = $1",
    [role.id],
  ))!;
  // Share link with the job's name in it; ?src= tells Applicants where each person came from.
  const short = `${baseUrl()}/apply/${role.slug}`;
  const linkFor = (src: string) => `${short}?src=${src}`;
  const save = savePost.bind(null, role.id);
  const v = new Date(role.updated_at ?? role.created_at).getTime(); // cache-buster so edits show on the poster
  const poster = (size: string) => `/api/poster/${role.id}?size=${size}&v=${encodeURIComponent(String(v))}`;
  const careersSnippet = `<!-- ${company.name} careers (JobBridge) -->\n<iframe src="${baseUrl()}/embed" title="Careers at ${company.name}"\n  style="width:100%;min-height:900px;border:0;border-radius:14px"></iframe>`;
  const frameId = `jobbridge-apply-${role.code}`;
  const formSnippet = [
    `<!-- ${company.name}: apply form for "${role.title}" -->`,
    `<iframe id="${frameId}" src="${baseUrl()}/embed/apply/${role.code}" title="Apply: ${role.title}"`,
    `  style="width:100%;max-width:720px;min-height:600px;border:0;display:block;margin:0 auto"></iframe>`,
    `<script>`,
    `  window.addEventListener("message", function (e) {`,
    `    if (e.data && e.data.jobbridge === "${role.code}")`,
    `      document.getElementById("${frameId}").style.height = e.data.height + "px";`,
    `  });`,
    `</script>`,
  ].join("\n");
  const live = role.status === "open";
  const sourceRows = await db.q<SourceRow>("select role_id, source, count(*)::int as n from applicants where role_id = $1 group by role_id, source", [role.id]);
  const edited = (await db.q<{ size: string }>("select size from poster_images where role_id = $1", [role.id])).map((r) => r.size);

  return (
    <>
      <RoleHeader role={role} tab="post" counts={counts} justCreated={!!created || !!saved} back={await backLink(from, { href: "/roles", label: "All jobs" }, company.id)} from={from} />
      {saved && !created && (
        <div className="mb-4">
          <Notice tone="ok">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex-1">Changes saved. The job details are updated everywhere this job is shown.</span>
              <Link href={`/roles/${role.slug}/edit`} className="btn btn-ghost shrink-0 bg-white px-3.5 py-1.5 text-[13px]"><Pencil size={13} /> Change the job details</Link>
            </span>
          </Notice>
        </div>
      )}

      {rewritten && !created && (
        <div className="mb-4">
          <Notice tone="ok">
            {rewritten === "ai" ? (
              <>Rewritten by Claude: the job description, captions, poster lines and screening questions are new. Check them below.</>
            ) : (
              <>
                Rewritten in a new style ({rewritten.replace("style-", "style ")} of 4): new wording for the job description, captions and poster lines. Click again for another style.{" "}
                <Link href="/settings" className="font-semibold underline">Connect AI in Settings</Link> for completely fresh wording every time.
              </>
            )}
          </Notice>
        </div>
      )}
      {created && <ScrollTop />}
      {created && (
        <div className="mb-4">
          <Notice tone="ok">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex-1">
                Job saved as a draft. The job post, captions and four poster designs are ready{role.written_by === "claude" ? " (written by Claude)" : ""}. Check them, then press <b>Publish job</b> to put it on the careers site.
              </span>
              <Link href={`/roles/${role.slug}/edit`} className="btn btn-ghost shrink-0 bg-white px-3.5 py-1.5 text-[13px]"><Pencil size={13} /> Change the job details</Link>
            </span>
          </Notice>
        </div>
      )}
      {role.status === "draft" && !created && (
        <div className="mb-6"><Notice tone="warn"><b>Draft.</b> Only you can see this job. Press <b>Publish job</b> when it is ready. Share links and posters work for the public once it is live.</Notice></div>
      )}
      {role.status === "closed" && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-shell bg-white px-4 py-3 text-sm text-slate">
          <span className="flex-1">
            {role.closed_reason === "filled"
              ? `All ${role.openings} position${role.openings > 1 ? "s were" : " was"} filled, so this job closed automatically and left the careers site.`
              : "This job is closed and no longer on the careers site."}
            {counts.waiting > 0 ? ` ${counts.waiting} applicant${counts.waiting > 1 ? "s are" : " is"} still waiting to hear back.` : ""}
          </span>
          {counts.waiting > 0 && (
            <form action={notifyRemaining.bind(null, role.id)}>
              <Submit className="btn btn-primary" pendingText="Sending…" confirm={`Send a polite "position filled" message to ${counts.waiting} applicant(s) and cancel their open interview invites?`}>Let them know politely</Submit>
            </form>
          )}
        </div>
      )}

      {/* 1. Poster */}
      <Step n={1} title="Poster" sub="Your ready-made poster in four sizes. Edit it like in Canva, then download.">
        <section className="card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)]">
            <Link href={`/roles/${role.slug}/poster`} className="group relative block bg-pearl p-5" aria-label="Edit poster">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster("portrait")} alt={`${role.title} poster`} className="aspect-[4/5] w-full rounded-xl border border-shell object-cover shadow-[0_10px_30px_rgba(6,59,103,0.15)]" />
              <span className="absolute right-8 bottom-8 flex items-center gap-1.5 rounded-full bg-lagoon px-3 py-1.5 text-[12px] font-bold text-white shadow"><Pencil size={12} /> Edit</span>
            </Link>
            <div className="flex flex-col p-6 sm:p-7">
              <div>{edited.length > 0 ? <span className="chip bg-mint text-lagoon"><Check size={12} /> Edited in the editor</span> : <span className="chip bg-pearl text-slate">Ready-made design</span>}</div>
              <p className="mt-3 max-w-xl text-[14px] text-slate">
                Open the editor to change anything: click any text to type, drag things around, change colours and fonts, add shapes, icons or your own photos. &quot;New variation&quot; makes a different design every time.
              </p>
              <div className="mt-4">
                <Link href={`/roles/${role.slug}/poster`} className="btn btn-primary px-5 py-3"><Palette size={16} /> Open poster editor</Link>
              </div>
              <div className="mt-auto pt-6">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-bold tracking-wide text-slate uppercase">Download</span>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/poster/${role.id}/all?pack=ads&v=${encodeURIComponent(String(v))}`} className="btn btn-ghost px-3.5 py-1.5 text-[13px]" title="Images named for Facebook, Instagram, LinkedIn and Google ads, with a guide"><Megaphone size={14} /> Download ad pack</a>
                    <a href={`/api/poster/${role.id}/all?v=${encodeURIComponent(String(v))}`} className="btn btn-primary px-3.5 py-1.5 text-[13px]"><Download size={14} /> Download all (4 sizes)</a>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
                  {POSTERS.map((p) => (
                    <a key={p.size} href={`${poster(p.size)}&download=1`} className="group flex items-center gap-3 rounded-xl border border-shell px-3 py-2.5 hover:border-coral">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-[13px] font-bold text-ink">{p.label} <Download size={12} className="text-coral" /></span>
                        <span className="block text-[11px] text-slate">{p.ratio} · {p.dims}{edited.includes(p.size) ? " · edited" : ""}</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Step>

      {/* 2. Job description */}
      <Step
        n={2}
        title="Full job description"
        sub="Shown when someone taps “Read the full job description” on the apply form. Click Edit to change it."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-mint text-lagoon"><Sparkles size={12} /> {role.written_by === "claude" ? "Written by Claude" : "Written from template"}</span>
            <form action={regeneratePost.bind(null, role.id)}>
              <Submit className="btn btn-ghost bg-white px-3 py-1.5 text-[13px]" pendingText="Rewriting…" confirm={ai ? "Rewrite the job post, captions, poster text and screening questions? Your edits will be replaced." : "Rewrite the job post, captions and poster text in a new style? Your edits will be replaced."}><RefreshCw size={13} /> {ai ? "Rewrite all with AI" : "Rewrite in a new style"}</Submit>
            </form>
          </div>
        }
      >
        <section className="card p-7">
          <EditableText action={save} field="description" value={role.description ?? ""} rows={22}>
            <JobDescription text={role.description ?? ""} className="max-w-3xl text-[15px] text-ink" />
          </EditableText>
        </section>
      </Step>

      {/* 3. Apply form fields */}
      <Step
        n={3}
        title="Apply form fields"
        sub="Choose what the apply form asks. Switch fields off or make them required, and add any field from the list."
        right={<a href={`/apply/${role.slug}`} target="_blank" className="btn btn-ghost bg-white px-3 py-1.5 text-[13px]"><Eye size={14} /> Preview form</a>}
      >
        <FormFieldsEditor action={saveFormFields.bind(null, role.id)} initial={role.form_fields} />
      </Step>

      {/* 4. Screening questions */}
      <Step n={4} title="Screening questions" sub="Asked at the end of the apply form. Yes/no questions with a preferred answer are scored automatically.">
        <ScreeningEditor action={saveScreening.bind(null, role.id)} initial={role.screening} />
      </Step>

      {/* 5. Share */}
      <Step
        n={5}
        last
        title="Share your job"
        sub={live ? "Your job is live. Post it with these links, the website snippet and the captions." : "Publish the job first. Until then these links only work for you."}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <section className="card p-6">
              <div className="eyebrow mb-2">Apply link for social posts</div>
              <p className="text-sm text-slate">Paste this link in your Facebook, LinkedIn, Instagram or WhatsApp post. People who click it go straight to the apply form.</p>
              <div className="mt-4 rounded-xl border border-seafoam bg-mint px-3 py-2.5 font-mono text-[13px] break-all text-lagoon">{short}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={short} label="Copy link" />
                <a href={short} target="_blank" className="btn btn-ghost px-3 py-1.5 text-[13px]">Open form</a>
              </div>
              <p className="mt-4 text-[12.5px] font-semibold text-ink">One link per platform, so Applicants shows where people came from:</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[["facebook", "Facebook"], ["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["whatsapp", "WhatsApp"], ["indeed", "Indeed / Reed"], ["email", "Email"]].map(([s, label]) => (
                  <CopyButton key={s} text={linkFor(s)} label={`${label} link`} />
                ))}
              </div>
            </section>

            <section className="card p-6">
              <div className="eyebrow mb-2">Form snippet for your website</div>
              <p className="text-sm text-slate">Paste this into any section of your website (a &quot;Custom HTML&quot; or &quot;Embed&quot; block). The apply form for this job shows right there, and applications land in Applicants.</p>
              <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-deep p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap text-pearl/90">{formSnippet}</pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={formSnippet} label="Copy form snippet" />
                <a href={`/embed/apply/${role.code}`} target="_blank" className="btn btn-ghost px-3 py-1.5 text-[13px]">Preview form</a>
              </div>
              <details className="mt-5 rounded-xl border border-shell p-3">
                <summary className="cursor-pointer text-[13px] font-semibold text-lagoon">All open jobs instead (careers section)</summary>
                <p className="mt-2 text-[13px] text-slate">Shows every open job. Visitors click a job to apply.</p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-deep p-3 text-[11.5px] leading-relaxed text-pearl/90">{careersSnippet}</pre>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyButton text={careersSnippet} label="Copy careers snippet" />
                  <a href="/embed" target="_blank" className="btn btn-ghost px-3 py-1.5 text-[13px]">Preview careers list</a>
                </div>
              </details>
            </section>
          </div>

          <section className="card p-7">
            <h3 className="font-display text-lg font-extrabold text-lagoon">Captions for each social network</h3>
            <p className="mt-1 mb-5 text-sm text-slate">Post the poster with these captions. Each one has its own link, so you can see which network brings the most applicants.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {CHANNELS.map((c) => {
                const text = ((role[c.field] as string | null) ?? "").replaceAll("{APPLY_LINK}", linkFor(c.src));
                return (
                  <div key={c.field} className="rounded-xl border border-shell bg-pearl/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="chip text-white" style={{ background: c.color }}>{c.label}</span>
                      <CopyButton text={text} />
                    </div>
                    <EditableText action={save} field={c.field} value={(role[c.field] as string | null) ?? ""} rows={9}>
                      <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-ink">{text}</p>
                    </EditableText>
                  </div>
                );
              })}
            </div>
          </section>

          {counts.applicants > 0 && <SourcesCard jobs={[{ id: role.id, title: role.title }]} rows={sourceRows} fixedJob={role.id} />}
        </div>
      </Step>
    </>
  );
}
