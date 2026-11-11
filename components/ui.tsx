import type { Band } from "@/lib/types";
import { BAND_LABEL, STAGE_LABEL, waLink } from "@/lib/format";
import { BrandStar, BridgeArc } from "./logo";

export function PageHeader({ eyebrow, title, children, sub }: { eyebrow?: string; title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1.5 !text-coral">{eyebrow}</div>}
        <h1 className="font-display text-[30px] leading-tight font-extrabold tracking-[-0.01em] text-lagoon">{title}</h1>
        <BridgeArc className="mt-2" />
        {sub && <p className="mt-2 max-w-2xl text-[15px] text-slate">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const BAND_STYLE: Record<Band, string> = {
  strong: "bg-mint text-seafoam-dark",
  maybe: "bg-amber-soft text-amber",
  nofit: "bg-rust-soft text-rust",
};

export function BandChip({ band }: { band: Band | null }) {
  if (!band) return <span className="chip bg-shell text-slate">Not scored</span>;
  return (
    <span className={`chip ${BAND_STYLE[band]}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {BAND_LABEL[band]}
    </span>
  );
}

const STAGE_STYLE: Record<string, string> = {
  applied: "bg-pearl text-slate border border-shell",
  shortlisted: "bg-mint text-lagoon",
  invited: "bg-coral-soft text-coral",
  booked: "bg-lagoon text-white",
  interviewed: "bg-deep text-white",
  no_show: "bg-rust-soft text-rust",
  rejected: "bg-shell text-slate",
  hired: "bg-seafoam-dark text-white",
};

export function StageChip({ stage }: { stage: string }) {
  return <span className={`chip ${STAGE_STYLE[stage] ?? ""}`}>{STAGE_LABEL[stage] ?? stage}</span>;
}

/** Static score ring (no animation). */
export function ScoreRing({ score, band, size = 52 }: { score: number | null; band: Band | null; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  const color = band === "strong" ? "#0E7A4E" : band === "maybe" ? "#A8701A" : "#B0413E";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E7E1D6" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display text-[15px] font-semibold text-ink">{score ?? "–"}</div>
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? "border-seafoam bg-mint" : ""}`}>
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-[32px] leading-none font-semibold text-lagoon">{value}</div>
      {hint && <div className="mt-2 text-[13px] text-slate">{hint}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card border-dashed px-6 py-12 text-center">
      <div className="font-display text-lg text-lagoon">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-slate">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const style = tone === "warn" ? "bg-amber-soft text-amber border-amber/20" : tone === "ok" ? "bg-mint text-seafoam-dark border-seafoam/30" : "bg-white text-slate border-shell";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${style}`}>{children}</div>;
}

const ROLE_STATUS: Record<string, [string, string]> = {
  draft: ["Draft · not public", "bg-amber-soft text-amber"],
  open: ["Live", "bg-mint text-seafoam-dark"],
  closed: ["Closed", "bg-shell text-slate"],
};

export function RoleStatusChip({ status, reason }: { status: string; reason?: string | null }) {
  const [label, style] = ROLE_STATUS[status] ?? [status, "bg-shell text-slate"];
  return <span className={`chip ${style}`}>{status === "closed" && reason === "filled" ? "Filled · closed automatically" : label}</span>;
}

/** "2 of 3 hired" progress bar. */
export function OpeningsBar({ hired, openings }: { hired: number; openings: number }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] text-slate">
        <span>{hired} of {openings} hired</span>
        {hired >= openings && <span className="font-semibold text-seafoam-dark">All filled</span>}
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-pearl">
        <div className="h-1.5 rounded-full bg-coral" style={{ width: `${Math.min(100, (hired / Math.max(1, openings)) * 100)}%` }} />
      </div>
    </div>
  );
}

/** Opens a WhatsApp chat with the applicant (wa.me), with an optional greeting already typed. */
export function WhatsAppLink({ phone, text, label = "WhatsApp", compact = false }: { phone: string | null | undefined; text?: string; label?: string; compact?: boolean }) {
  const href = waLink(phone, text);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Chat on WhatsApp with ${phone}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#25D366] font-bold text-white hover:bg-[#1ebe5b] ${compact ? "h-8 w-8 justify-center" : "px-3.5 py-2 text-[13px]"}`}
    >
      <svg width={compact ? 16 : 15} height={compact ? 16 : 15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.05c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.24-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82s.7-2 .95-2.27c.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.24.55.79 1.9.86 2.04.07.14.11.3.02.48-.09.18-.13.29-.27.45-.13.16-.28.35-.4.47-.13.13-.27.28-.12.55.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.58-.07.16-.18.67-.78.85-1.05.18-.27.36-.22.61-.13.25.09 1.58.75 1.85.88.27.14.45.2.52.32.07.11.07.65-.17 1.33z" />
      </svg>
      {!compact && label}
    </a>
  );
}

/** Page banner in the brand gradient, matching the dashboard. Optional stat tiles underneath the title. */
export function HeroHeader({ eyebrow, title, sub, children, stats }: { eyebrow: string; title: string; sub?: React.ReactNode; children?: React.ReactNode; stats?: { label: string; value: React.ReactNode; tone?: "sky" | "green" | "amber" }[] }) {
  const TONE = { sky: "text-[#5db6f7]", green: "text-[#7fe0b0]", amber: "text-[#f7c873]" };
  return (
    <section className="bridge-gradient relative mb-6 overflow-clip rounded-[22px] p-6 text-white sm:p-8">
      <svg className="pointer-events-none absolute -right-10 -bottom-6 hidden sm:block" width="420" height="190" viewBox="0 0 420 190" aria-hidden="true">
        <path d="M10 190C80 20 340 20 410 190" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="40" />
        <path d="M100 190C140 90 280 90 320 190" fill="none" stroke="rgba(93,182,247,0.28)" strokeWidth="16" />
      </svg>
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[11.5px] font-bold tracking-[0.16em] text-[#5db6f7] uppercase">
            <BrandStar size={11} /> {eyebrow}
          </div>
          <h1 className="mt-2 font-display text-[28px] leading-tight font-extrabold sm:text-[34px]">{title}</h1>
          {sub && <p className="mt-2 max-w-xl text-[15px] text-white/75">{sub}</p>}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
      {stats && (
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <div className={`font-display text-[26px] leading-none font-extrabold ${s.tone ? TONE[s.tone] : "text-white"}`}>{s.value}</div>
              <div className="mt-1.5 text-[12.5px] font-semibold text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Round initials badge for a person. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const hues = ["#063B67", "#047CD3", "#0E7A4E", "#3A9BE8", "#24577A"];
  const bg = hues[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % hues.length];
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-display font-extrabold text-white" style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}
