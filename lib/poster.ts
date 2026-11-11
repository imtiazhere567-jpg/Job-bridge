import { placeText, salaryText } from "./jobpost";
import type { PosterDesign, PosterTemplate, Role } from "./types";

/** The brand guide a poster is built from (Settings → Brand guide and business profile). */
export interface Brand {
  primary: string;
  accent: string;
  email: string | null;
  website: string | null;
  phone: string | null;
}

/** Mix two colours: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** The four poster designs. Their colours all come from the brand guide. */
export const TEMPLATES: { id: PosterTemplate; name: string; note: string }[] = [
  { id: "studio", name: "Studio chair", note: "Light and clean, big \"Hiring\" with an office chair" },
  { id: "stripe", name: "Megaphone stripe", note: "Bold brand stripe with a megaphone" },
  { id: "bold", name: "Bold brand", note: "Full brand colour, chair and question mark" },
  { id: "spotlight", name: "Announcement", note: "Deep brand colour, centred, megaphone" },
];

/** Colours for each design, worked out from the brand guide. */
export function templateColors(id: PosterTemplate, brand: Pick<Brand, "primary" | "accent">): Pick<PosterDesign, "bg" | "accent" | "text"> {
  const { primary, accent } = brand;
  const light = mix(accent, "#FFFFFF", 0.45);
  switch (id) {
    case "studio":
      return { bg: mix(primary, "#FFFFFF", 0.94), accent: primary, text: mix(primary, "#0B1118", 0.6) };
    case "stripe":
      return { bg: "#F4F4F1", accent: primary, text: "#121820" };
    case "bold":
      return { bg: primary, accent: light, text: "#FFFFFF" };
    default:
      return { bg: mix(primary, "#000000", 0.35), accent: light, text: "#FFFFFF" };
  }
}

/** One-click colour sets in the editor, all from the brand guide. */
export function palettes(brand: Pick<Brand, "primary" | "accent">) {
  const { primary, accent } = brand;
  const light = mix(accent, "#FFFFFF", 0.45);
  return [
    { name: "Light", bg: mix(primary, "#FFFFFF", 0.94), accent: primary, text: mix(primary, "#0B1118", 0.6) },
    { name: "White", bg: "#FFFFFF", accent: accent, text: "#121820" },
    { name: "Brand", bg: primary, accent: light, text: "#FFFFFF" },
    { name: "Accent", bg: accent, accent: "#FFFFFF", text: "#FFFFFF" },
    { name: "Deep", bg: mix(primary, "#000000", 0.35), accent: light, text: "#FFFFFF" },
  ];
}

export const brandOf = (c: { brand_color: string; accent_color: string; email?: string | null; website?: string | null; phone?: string | null }): Brand => ({
  primary: c.brand_color,
  accent: c.accent_color,
  email: c.email ?? null,
  website: c.website ?? null,
  phone: c.phone ?? null,
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const site = (w: string | null) => (w ? w.replace(/^https?:\/\//, "").replace(/\/$/, "") : "");

/** The poster text the assistant wrote for a role, plus the key facts. */
export function baseCopy(role: Role, brand: Brand): Omit<PosterDesign, "template" | "bg" | "accent" | "text"> {
  return {
    v: 2,
    kicker: "We Are",
    headline: "Hiring",
    tagline: role.poster_headline ?? "Join our team",
    label: role.openings > 1 ? `${role.openings} Open Positions` : "Open Position",
    title: role.title,
    intro: role.poster_tagline ?? "",
    points: [salaryText(role), [role.employment, role.shift].filter(Boolean).join(" · "), placeText(role)].filter(Boolean),
    cta: "Apply Now",
    contact: brand.email ?? "",
    footer: site(brand.website) || (brand.phone ?? ""),
  };
}

/** Four variations of the same poster, one per design, in the brand colours. */
export function variations(role: Role, brand: Brand): PosterDesign[] {
  const copy = baseCopy(role, brand);
  return TEMPLATES.map((t) => ({ ...copy, template: t.id, ...templateColors(t.id, brand) }));
}

/** The role's saved poster, or the first variation if none has been chosen yet. */
export const designFor = (role: Role, brand: Brand): PosterDesign => (role.poster?.v === 2 && TEMPLATES.some((t) => t.id === role.poster!.template) ? role.poster : variations(role, brand)[0]);

/** Clean up a design coming from the editor (or a URL) so it is always safe to render. */
export function sanitize(input: unknown, fallback: PosterDesign): PosterDesign {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const template = TEMPLATES.some((t) => t.id === d.template) ? (d.template as PosterTemplate) : fallback.template;
  const color = (k: "bg" | "accent" | "text") => (typeof d[k] === "string" && HEX.test(d[k] as string) ? (d[k] as string) : fallback[k]);
  const text = (k: "kicker" | "headline" | "tagline" | "label" | "intro" | "contact" | "footer", n: number) => (d[k] !== undefined ? clip(d[k], n) : fallback[k]);
  const points = Array.isArray(d.points) ? d.points.map((p) => clip(p, 60)).filter(Boolean).slice(0, 4) : fallback.points;
  return {
    v: 2,
    template,
    kicker: text("kicker", 24),
    headline: text("headline", 28),
    tagline: text("tagline", 50),
    label: text("label", 30),
    title: clip(d.title ?? fallback.title, 48) || fallback.title,
    intro: text("intro", 120),
    points,
    cta: clip(d.cta ?? fallback.cta, 24) || fallback.cta,
    contact: text("contact", 48),
    footer: text("footer", 48),
    bg: color("bg"),
    accent: color("accent"),
    text: color("text"),
  };
}

/** Readable text colour for a background. */
export function onColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#0C1B2E" : "#FFFFFF";
}

export const isDark = (hex: string) => onColor(hex) === "#FFFFFF";
