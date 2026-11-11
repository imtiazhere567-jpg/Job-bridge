"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, Megaphone, Palette, RotateCcw, Save, Sparkles, Type } from "lucide-react";
import type { PosterDesign, PosterTemplate } from "@/lib/types";

type Size = "portrait" | "square" | "linkedin" | "story";
interface Props {
  roleId: number;
  initial: PosterDesign;
  defaults: PosterDesign[];
  templates: { id: PosterTemplate; name: string; note: string; colors: { bg: string; accent: string; text: string } }[];
  palettes: { name: string; bg: string; accent: string; text: string }[];
  save: (json: string) => Promise<{ ok: boolean }>;
  rewrite: () => Promise<{ headline: string; tagline: string } | null>;
}

const SIZES: { id: Size; label: string; dims: string; ratio: string }[] = [
  { id: "portrait", label: "Instagram post", dims: "1080 × 1350", ratio: "aspect-[4/5]" },
  { id: "square", label: "Facebook square", dims: "1080 × 1080", ratio: "aspect-square" },
  { id: "linkedin", label: "LinkedIn", dims: "1200 × 627", ratio: "aspect-[1200/627]" },
  { id: "story", label: "WhatsApp Status", dims: "1080 × 1920", ratio: "aspect-[9/16]" },
];

const src = (roleId: number, d: PosterDesign, size: Size, download = false) =>
  `/api/poster/${roleId}?size=${size}&d=${encodeURIComponent(JSON.stringify(d))}${download ? "&download=1" : ""}`;

/** Poster studio: pick one of four designs, then edit its text and colours with a live preview. */
export function PosterStudio({ roleId, initial, defaults, templates, palettes, save, rewrite }: Props) {
  const [design, setDesign] = useState<PosterDesign>(initial);
  const [shown, setShown] = useState<PosterDesign>(initial); // what the preview images use (updated after typing pauses)
  const [size, setSize] = useState<Size>("portrait");
  const [status, setStatus] = useState<"" | "saving" | "saved" | "writing">("");

  useEffect(() => {
    const t = setTimeout(() => setShown(design), 450);
    return () => clearTimeout(t);
  }, [design]);

  const set = <K extends keyof PosterDesign>(k: K, v: PosterDesign[K]) => {
    setDesign((d) => ({ ...d, [k]: v }));
    setStatus("");
  };
  const choose = (t: (typeof templates)[number]) => {
    setDesign((d) => ({ ...d, template: t.id, ...t.colors }));
    setStatus("");
  };
  const thumbs = useMemo(() => templates.map((t) => ({ t, d: { ...shown, template: t.id, ...t.colors } })), [templates, shown]);
  const current = SIZES.find((s) => s.id === size)!;
  const points = [...design.points, "", "", "", ""].slice(0, 4);
  const showsIntro = design.template === "bold" || design.template === "spotlight";

  return (
    <div className="space-y-6">
      {/* Step 1: four variations */}
      <section className="card p-6">
        <StepHead n={1} title="Choose a design" note="Four variations in your brand colours. Your text stays when you switch." />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {thumbs.map(({ t, d }) => {
            const active = design.template === t.id;
            return (
              <button key={t.id} type="button" onClick={() => choose(t)} className={`overflow-hidden rounded-2xl border-2 bg-white text-left ${active ? "border-coral ring-4 ring-coral/15" : "border-shell hover:border-seafoam"}`}>
                <div className="relative aspect-[4/5] bg-pearl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(roleId, d, "portrait")} alt={`${t.name} design`} className="h-full w-full object-cover" />
                  {active && <span className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-coral text-white"><Check size={16} strokeWidth={3} /></span>}
                </div>
                <div className={`px-3 py-2.5 ${active ? "bg-mint" : ""}`}>
                  <div className="text-sm font-bold text-ink">{t.name}</div>
                  <div className="text-[12px] leading-snug text-slate">{t.note}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Step 2: preview */}
        <section className="card self-start p-6 lg:sticky lg:top-6">
          <StepHead n={2} title="Preview & download" />
          <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-2xl bg-pearl p-1.5 xl:grid-cols-4">
            {SIZES.map((s) => (
              <button key={s.id} type="button" onClick={() => setSize(s.id)} className={`rounded-xl px-2 py-2 text-center ${size === s.id ? "bg-lagoon text-white" : "text-slate hover:bg-white"}`}>
                <div className="text-[12.5px] font-bold">{s.label}</div>
                <div className={`text-[10.5px] ${size === s.id ? "text-white/70" : "text-slate"}`}>{s.dims}</div>
              </button>
            ))}
          </div>
          <div className={`mx-auto overflow-hidden rounded-2xl border border-shell bg-pearl shadow-sm ${current.ratio} ${size === "story" ? "max-w-[300px]" : size === "portrait" ? "max-w-[440px]" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(roleId, shown, size)} alt="Poster preview" className="h-full w-full object-cover" />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12.5px] text-slate">The QR code opens this job&apos;s apply page.</span>
            <a href={src(roleId, shown, size, true)} className="btn btn-ghost"><Download size={15} /> Download {current.label}</a>
          </div>
        </section>

        {/* Step 3: edit */}
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <StepHead n={3} title="Edit text and colours" />
            <button
              type="button"
              className="btn btn-ghost px-3 py-1.5 text-[13px]"
              disabled={status === "writing"}
              onClick={async () => {
                setStatus("writing");
                const r = await rewrite();
                if (r) setDesign((d) => ({ ...d, tagline: r.headline, intro: r.tagline }));
                setStatus("");
              }}
            >
              <Sparkles size={14} /> {status === "writing" ? "Writing…" : "Rewrite with AI"}
            </button>
          </div>

          <Group icon={<Type size={15} />} title="Headline">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
              <Field label="Handwritten line" value={design.kicker} onChange={(v) => set("kicker", v)} max={24} />
              <Field label="Big word" value={design.headline} onChange={(v) => set("headline", v)} max={28} big />
            </div>
            <Field label="Line under it" value={design.tagline} onChange={(v) => set("tagline", v)} max={50} />
          </Group>

          <Group icon={<Megaphone size={15} />} title="The job">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
              <Field label="Label" value={design.label} onChange={(v) => set("label", v)} max={30} />
              <Field label="Job title" value={design.title} onChange={(v) => set("title", v)} max={48} big />
            </div>
            <Field label={`Short intro${showsIntro ? "" : " (shown in Bold brand and Announcement)"}`} value={design.intro} onChange={(v) => set("intro", v)} max={120} />
            <div>
              <span className="label">Key points <span className="font-normal text-slate">(salary, timing, location…)</span></span>
              <div className="grid gap-2 xl:grid-cols-2">
                {points.map((p, i) => (
                  <input key={i} value={p} maxLength={60} placeholder={i < 3 ? "Add a point" : "Optional 4th point"} className="field py-2 text-sm" onChange={(e) => set("points", points.map((x, k) => (k === i ? e.target.value : x)))} />
                ))}
              </div>
            </div>
          </Group>

          <Group icon={<Check size={15} />} title="How to apply">
            <div className="grid gap-3 xl:grid-cols-2">
              <Field label="Button" value={design.cta} onChange={(v) => set("cta", v)} max={24} />
              <Field label="Email or contact" value={design.contact} onChange={(v) => set("contact", v)} max={48} />
            </div>
            <Field label="Website or social handle" value={design.footer} onChange={(v) => set("footer", v)} max={48} />
          </Group>

          <Group icon={<Palette size={15} />} title="Colours">
            <div className="flex flex-wrap gap-4">
              <Swatch label="Background" value={design.bg} onChange={(v) => set("bg", v)} />
              <Swatch label="Main colour" value={design.accent} onChange={(v) => set("accent", v)} />
              <Swatch label="Text" value={design.text} onChange={(v) => set("text", v)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {palettes.map((p) => (
                <button key={p.name} type="button" onClick={() => setDesign((d) => ({ ...d, bg: p.bg, accent: p.accent, text: p.text }))} className="flex items-center gap-2 rounded-full border border-shell bg-white py-1 pr-3 pl-1 text-[12px] font-semibold text-slate hover:border-seafoam">
                  <span className="flex overflow-hidden rounded-full border border-shell">
                    <span className="h-5 w-3" style={{ background: p.bg }} />
                    <span className="h-5 w-3" style={{ background: p.accent }} />
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          </Group>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-shell pt-5">
            <button
              type="button"
              className="btn btn-primary px-5 py-3"
              disabled={status === "saving"}
              onClick={async () => {
                setStatus("saving");
                const r = await save(JSON.stringify(design));
                setStatus(r.ok ? "saved" : "");
              }}
            >
              <Save size={16} /> {status === "saving" ? "Saving…" : "Save poster"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setDesign({ ...defaults.find((x) => x.template === design.template)! }); setStatus(""); }}>
              <RotateCcw size={15} /> Reset this design
            </button>
            {status === "saved" && <span className="flex items-center gap-1 text-sm font-semibold text-seafoam-dark"><Check size={15} /> Saved. Your job page and downloads now use this poster.</span>}
          </div>
        </section>
      </div>
    </div>
  );
}

function StepHead({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-extrabold text-lagoon">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-coral text-[13px] text-white">{n}</span>
        {title}
      </h2>
      {note && <span className="text-sm text-slate">{note}</span>}
    </div>
  );
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-shell bg-pearl/60 p-4">
      <div className="flex items-center gap-2 text-[13px] font-extrabold tracking-wide text-lagoon uppercase">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-mint text-coral">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, max, big }: { label: string; value: string; onChange: (v: string) => void; max: number; big?: boolean }) {
  return (
    <label className="block">
      <span className="label flex justify-between">{label}<span className="font-normal text-slate">{value.length}/{max}</span></span>
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className={`field bg-white ${big ? "font-display text-[16px] font-bold" : ""}`} />
    </label>
  );
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-shell bg-white" />
      <span className="flex flex-col leading-tight">{label}<span className="font-mono text-[11px] font-normal text-slate">{value}</span></span>
    </label>
  );
}
