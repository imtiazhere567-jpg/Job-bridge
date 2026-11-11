/* Poster designs built from separate Fabric.js layers, so every text, shape and picture can be edited like in Canva. */
import type * as Fab from "fabric";
import { bubbleSvg, chairSvg, iconSvg, megaphoneSvg, meshChairSvg, mixHex, starSvg, svgUrl } from "@/lib/poster-art";

export type DesignId = "glass" | "studio" | "stripe" | "bold" | "spotlight" | "custom";
export type SizeId = "portrait" | "square" | "story" | "linkedin";
export const SIZES: Record<SizeId, { w: number; h: number; label: string }> = {
  portrait: { w: 1080, h: 1350, label: "Instagram post" },
  square: { w: 1080, h: 1080, label: "Facebook square" },
  story: { w: 1080, h: 1920, label: "WhatsApp Status" },
  linkedin: { w: 1200, h: 627, label: "LinkedIn" },
};
export const DESIGNS: { id: DesignId; name: string }[] = [
  { id: "glass", name: "Glass" },
  { id: "studio", name: "Studio chair" },
  { id: "stripe", name: "Megaphone stripe" },
  { id: "bold", name: "Bold brand" },
  { id: "spotlight", name: "Announcement" },
];

export interface PosterContent {
  kicker: string;
  headline: string;
  tagline: string;
  label: string;
  title: string;
  intro: string;
  points: string[];
  requirements: string[];
  cta: string;
  contact: string;
  footer: string;
  workMode: string;
  salary: string;
  place: string;
  link: string;
  qr: string; // data URL
}
export interface Brand {
  primary: string;
  accent: string;
}
/** Random choices that make each "New variation" different. */
export interface Variant {
  art: "chair" | "mesh" | "megaphone";
  flip: boolean;
  bubble: "heart" | "like" | "star";
  tone: 0 | 1 | 2;
  /** Set for designs made by "New variation": the recipe the generator follows. */
  gen?: Gen;
}

/** Recipe for a generated design. Each "New variation" picks a new mix. */
export interface Gen {
  theme: "dark" | "light" | "accent";
  bg: "gradient" | "split" | "circles" | "arch" | "dots";
  art: "chair" | "mesh" | "megaphone" | "none";
  artPos: "right" | "left" | "bottom";
  head: "stack" | "script" | "band" | "outline";
  title: "dot" | "pill" | "plain";
  card: "glass" | "solid" | "outline" | "none";
  list: "requirements" | "points";
  cta: "pill" | "box" | "bar";
  deco: ("bubbles" | "rings" | "swoosh" | "bgword" | "stars")[];
  center: boolean;
}
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const KEYS: (keyof Gen)[] = ["theme", "bg", "art", "artPos", "head", "card", "cta"];
/** A new recipe that differs from the previous one in at least three main choices. */
export function randomGen(prev?: Gen): Gen {
  for (let tries = 0; tries < 50; tries++) {
    const art = pick(["chair", "mesh", "megaphone", "none"] as const);
    const artPos = art === "none" ? "bottom" : pick(["right", "left", "bottom", "right"] as const);
    const g: Gen = {
      theme: pick(["dark", "light", "accent", "dark"] as const),
      bg: pick(["gradient", "split", "circles", "arch", "dots"] as const),
      art,
      artPos,
      head: pick(["stack", "script", "band", "outline"] as const),
      title: pick(["dot", "pill", "plain"] as const),
      card: pick(["glass", "solid", "outline", "none"] as const),
      list: pick(["requirements", "points", "requirements"] as const),
      cta: pick(["pill", "box", "bar"] as const),
      deco: (["bubbles", "rings", "swoosh", "bgword", "stars"] as const).filter(() => Math.random() < 0.35),
      center: artPos === "bottom" && Math.random() < 0.7,
    };
    if (g.theme === "light" && g.card === "glass") g.card = "solid";
    if (!prev || KEYS.filter((k) => g[k] !== prev[k]).length >= 3) return g;
  }
  return randomGen();
}
export const randomVariant = (): Variant => ({
  art: (["chair", "mesh", "megaphone"] as const)[Math.floor(Math.random() * 3)],
  flip: Math.random() < 0.35,
  bubble: (["heart", "like", "star"] as const)[Math.floor(Math.random() * 3)],
  tone: Math.floor(Math.random() * 3) as 0 | 1 | 2,
});
export const defaultVariant: Variant = { art: "mesh", flip: false, bubble: "heart", tone: 0 };

const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImg(url: string) {
  if (!imgCache.has(url))
    imgCache.set(
      url,
      new Promise((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      }),
    );
  return imgCache.get(url)!;
}

export const FONTS = { head: "PMontserrat", body: "PFigtree", script: "PScript" };
export async function loadFonts() {
  await Promise.all([
    ...[500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px ${FONTS.head}`)),
    document.fonts.load(`500 40px ${FONTS.body}`),
    document.fonts.load(`700 40px ${FONTS.body}`),
    document.fonts.load(`400 40px ${FONTS.script}`),
  ]);
}

type F = typeof Fab;
type Obj = Fab.FabricObject;
interface Ctx {
  F: F;
  W: number;
  H: number;
  c: PosterContent;
  b: Brand;
  v: Variant;
  objs: Obj[];
}

// ---------- small builders ----------
function T(x: Ctx, text: string, o: { left: number; top: number; width: number; size: number; font?: string; weight?: number | string; color: string; align?: string; lh?: number; spacing?: number; name?: string; angle?: number }) {
  const t = new x.F.Textbox(text, {
    left: o.left,
    top: o.top,
    width: o.width,
    fontSize: o.size,
    fontFamily: o.font ?? FONTS.head,
    fontWeight: o.weight ?? 700,
    fill: o.color,
    textAlign: o.align ?? "left",
    lineHeight: o.lh ?? 1.12,
    charSpacing: o.spacing ?? 0,
    angle: o.angle ?? 0,
  });
  (t as Obj & { name?: string }).name = o.name ?? "Text";
  x.objs.push(t);
  return t;
}
/** Width of the longest line actually used by a textbox. */
const used = (t: Fab.Textbox) => Math.max(...t.textLines.map((_, i) => t.getLineWidth(i)));
const bottom = (o: Obj) => (o.top ?? 0) + o.getScaledHeight();

function R(x: Ctx, o: Partial<Fab.RectProps> & { left: number; top: number; width: number; height: number; name?: string }) {
  const r = new x.F.Rect({ ...o, rx: o.rx ?? 0, ry: o.rx ?? 0 });
  (r as Obj & { name?: string }).name = o.name ?? "Shape";
  x.objs.push(r);
  return r;
}
function C(x: Ctx, o: Partial<Fab.CircleProps> & { left: number; top: number; radius: number; name?: string }) {
  const c = new x.F.Circle(o);
  (c as Obj & { name?: string }).name = o.name ?? "Circle";
  x.objs.push(c);
  return c;
}
async function I(x: Ctx, url: string, o: { left: number; top: number; width?: number; height?: number; name?: string; opacity?: number; angle?: number; flip?: boolean }) {
  const el = await loadImg(url);
  const im = new x.F.FabricImage(el, { left: o.left, top: o.top, opacity: o.opacity ?? 1, angle: o.angle ?? 0, flipX: !!o.flip });
  if (o.width) im.scaleToWidth(o.width);
  else if (o.height) im.scaleToHeight(o.height);
  (im as Obj & { name?: string }).name = o.name ?? "Image";
  x.objs.push(im);
  return im;
}
const grad = (x: Ctx, stops: [number, string][], dir: "v" | "h" | "d" = "v") =>
  new x.F.Gradient({
    type: "linear",
    gradientUnits: "percentage",
    coords: dir === "v" ? { x1: 0, y1: 0, x2: 0, y2: 1 } : dir === "h" ? { x1: 0, y1: 0, x2: 1, y2: 0 } : { x1: 0, y1: 0, x2: 1, y2: 1 },
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
  });
const radial = (x: Ctx, color: string, alpha = 0.55) =>
  new x.F.Gradient({
    type: "radial",
    gradientUnits: "percentage",
    coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 },
    colorStops: [
      { offset: 0, color: rgba(color, alpha) },
      { offset: 1, color: rgba(color, 0) },
    ],
  });
function rgba(hexColor: string, a: number) {
  const n = parseInt(hexColor.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function bg(x: Ctx, fill: string | Fab.Gradient<"linear">) {
  R(x, { left: 0, top: 0, width: x.W, height: x.H, fill, name: "Background", selectable: true, lockMovementX: true, lockMovementY: true, hasControls: false, hoverCursor: "default" });
}
/** A rounded button or tag: shape + text, grouped so they move together. */
function pill(x: Ctx, text: string, o: { left: number; top: number; size: number; fill: string | Fab.Gradient<"linear">; color: string; padX?: number; padY?: number; angle?: number; radius?: number; icon?: string; weight?: number; name?: string }) {
  const padX = o.padX ?? o.size * 0.9;
  const padY = o.padY ?? o.size * 0.45;
  const iconW = o.icon ? o.size * 1.15 : 0;
  const t = new x.F.Textbox(text, { fontSize: o.size, fontFamily: FONTS.head, fontWeight: o.weight ?? 800, fill: o.color, width: 2000, left: 0, top: 0 });
  const tw = Math.min(used(t), x.W - 120);
  t.set({ width: tw + 4, left: padX + iconW, top: padY });
  const h = t.getScaledHeight() + padY * 2;
  const r = new x.F.Rect({ left: 0, top: 0, width: tw + padX * 2 + iconW, height: h, rx: o.radius ?? h / 2, ry: o.radius ?? h / 2, fill: o.fill });
  const parts: Obj[] = [r, t];
  return { parts, w: r.width!, h, iconW, padX, padY, t, place: async () => {
    if (o.icon) {
      const el = await loadImg(svgUrl(iconSvg(o.icon, o.color, 64)));
      const im = new x.F.FabricImage(el, { left: padX * 0.75, top: (h - o.size * 0.95) / 2 });
      im.scaleToWidth(o.size * 0.95);
      parts.push(im);
    }
    const g = new x.F.Group(parts, { left: o.left, top: o.top, angle: o.angle ?? 0 });
    (g as Obj & { name?: string }).name = o.name ?? "Button";
    x.objs.push(g);
    return g;
  } };
}
async function logoMark(x: Ctx, white: boolean, o: { left: number; top: number; size: number }) {
  return I(x, white ? "/brand/jobbridge-mark-white.png" : "/brand/jobbridge-mark.png", { left: o.left, top: o.top, width: o.size, name: "Logo" });
}
function wordmark(x: Ctx, white: boolean, o: { left: number; top: number; size: number; align?: string; width?: number }) {
  const t = new x.F.Textbox("JOBBRIDGE", { left: o.left, top: o.top, width: o.width ?? o.size * 6.5, fontSize: o.size, fontFamily: FONTS.head, fontWeight: 800, textAlign: o.align ?? "left", fill: white ? "#FFFFFF" : "#063B67" });
  t.setSelectionStyles({ fill: white ? "#5DB6F7" : "#047CD3" }, 3, 9);
  (t as Obj & { name?: string }).name = "Brand name";
  x.objs.push(t);
  return t;
}
async function qr(x: Ctx, o: { left: number; top: number; size: number; border?: string }) {
  R(x, { left: o.left, top: o.top, width: o.size, height: o.size, rx: o.size * 0.1, fill: "#FFFFFF", stroke: o.border, strokeWidth: o.border ? 4 : 0, name: "QR frame" });
  return I(x, x.c.qr, { left: o.left + o.size * 0.08, top: o.top + o.size * 0.08, width: o.size * 0.84, name: "QR code" });
}
const bullets = (items: string[], mark = "•") => items.map((p) => `${mark}  ${p}`).join("\n");
/** Headline size: as big as possible, on one line if the word allows. */
const bigSize = (text: string, max: number, width: number, em = 0.62) => Math.min(max, width / Math.max(1, text.length * em));

async function art(x: Ctx, kind: Variant["art"], color: string, o: { left: number; top: number; width: number; flip?: boolean; waves?: boolean }) {
  const url = kind === "megaphone" ? svgUrl(megaphoneSvg(mixHex(color, "#FFFFFF", 0.35), o.waves)) : kind === "mesh" ? svgUrl(meshChairSvg(color)) : svgUrl(chairSvg(color));
  return I(x, url, { left: o.left, top: o.top, width: o.width, flip: o.flip, name: kind === "megaphone" ? "Megaphone" : "Chair" });
}

// ---------- 1. Glass (dark brand colour, frosted cards, big "Hiring", chair, like bubbles) ----------
async function glass(x: Ctx, k: number) {
  const { W, H, c, b, v } = x;
  const pad = 80;
  const dark = mixHex(b.primary, "#000000", v.tone === 2 ? 0.62 : 0.5);
  const glow = v.tone === 1 ? b.accent : mixHex(b.accent, "#FFFFFF", 0.2);
  const light = mixHex(b.accent, "#FFFFFF", 0.55);
  bg(x, grad(x, [[0, mixHex(b.primary, "#FFFFFF", 0.06)], [0.55, b.primary], [1, dark]]));
  const arc = new x.F.Path(`M0 0 H${W} V${H * 0.08} Q${W * 0.5} ${H * 0.2} 0 ${H * 0.08} Z`, { fill: rgba("#FFFFFF", 0.07) });
  (arc as Obj & { name?: string }).name = "Shape";
  x.objs.push(arc);
  C(x, { left: W * 0.32, top: H * 0.28, radius: W * 0.55, fill: radial(x, glow, 0.38), name: "Glow" });
  await logoMark(x, true, { left: W / 2 - 55, top: H * 0.03, size: 110 });

  const artLeft = v.flip ? -W * 0.08 : W * 0.46;
  const artW = W * (H > 1500 ? 0.62 : 0.58);
  const artTop = H - artW * (v.art === "megaphone" ? 0.8 : v.art === "mesh" ? 1.23 : 1.5) - 10;
  await art(x, v.art, mixHex(b.accent, "#FFFFFF", 0.15), { left: artLeft, top: Math.max(H * 0.3, artTop), width: artW, flip: v.flip });
  await I(x, svgUrl(bubbleSvg(b.accent, v.bubble)), { left: v.flip ? W * 0.06 : W * 0.78, top: H * 0.2, width: 190, opacity: 0.9, angle: 12, name: "Bubble" });
  await I(x, svgUrl(bubbleSvg(b.accent, v.bubble === "heart" ? "like" : "heart")), { left: v.flip ? W * 0.84 : -40, top: H * 0.5, width: 150, opacity: 0.85, angle: -14, name: "Bubble" });

  const left = v.flip ? W * 0.36 : pad;
  const colW = W - pad - left - (v.flip ? 0 : W * 0.3);
  let y = H * (H > 1500 ? 0.16 : 0.15);
  const k1 = T(x, c.kicker || "We're", { left, top: y, width: W - left - pad, size: 140 * k, weight: 800, color: "#F2F7FF", lh: 0.95 });
  y = bottom(k1) - 10 * k;
  const big = c.headline || "Hiring";
  const h1 = T(x, big, { left, top: y, width: W - left - pad, size: bigSize(big, 290 * k, W * 0.7, 0.6), weight: 800, color: "#F2F7FF", lh: 0.92, spacing: -20 });
  y = bottom(h1) + 22 * k;
  C(x, { left, top: y + 30 * k, radius: 17 * k, fill: light, name: "Dot" });
  const tt = T(x, c.title, { left: left + 54 * k, top: y, width: colW + W * 0.12, size: 64 * k, weight: 800, color: "#FFFFFF", lh: 1.05, spacing: -10 });
  y = bottom(tt);
  if (c.workMode) {
    const end = left + 54 * k + Math.min(used(tt), tt.width!);
    const p = pill(x, c.workMode, { left: Math.min(end - 150 * k, W - 260 * k), top: y - 4 * k, size: 34 * k, fill: grad(x, [[0, light], [1, b.accent]], "h"), color: mixHex(b.primary, "#000000", 0.35), angle: -10, name: "Work type tag" });
    await p.place();
  }
  y += (c.workMode ? 84 : 50) * k;

  // Frosted card: requirements + location / salary
  const cardW = v.flip ? W - left - pad : W * 0.64;
  const cardTop = y;
  const cardIn = 46 * k;
  const reqs = c.requirements.length ? c.requirements : c.points;
  const card = R(x, { left, top: cardTop, width: cardW, height: 100, rx: 34, fill: rgba("#FFFFFF", 0.08), stroke: rgba("#FFFFFF", 0.16), strokeWidth: 2, name: "Glass card" });
  let cy = cardTop + cardIn;
  const rh = T(x, "Requirements", { left: left + cardIn, top: cy, width: cardW - cardIn * 2, size: 52 * k, weight: 800, color: light });
  cy = bottom(rh) + 18 * k;
  const rl = T(x, bullets(reqs.slice(0, 5)), { left: left + cardIn, top: cy, width: cardW - cardIn * 2, size: 29 * k, font: FONTS.body, weight: 500, color: "#F2F7FF", lh: 1.25 });
  cy = bottom(rl) + 30 * k;
  const info = [
    { icon: "pin", label: "Location:", value: c.place || c.workMode },
    { icon: "money", label: "Salary:", value: c.salary },
  ].filter((i) => i.value);
  let rowH = 0;
  for (const [i, it] of info.entries()) {
    const ix = left + cardIn + i * ((cardW - cardIn * 2) / 2);
    await I(x, svgUrl(iconSvg(it.icon, light, 64)), { left: ix, top: cy + 4, width: 46 * k, name: "Icon" });
    const l1 = T(x, it.label, { left: ix + 58 * k, top: cy, width: (cardW - cardIn * 2) / 2 - 64 * k, size: 22 * k, font: FONTS.body, weight: 500, color: rgba("#FFFFFF", 0.75) as string });
    const l2 = T(x, it.value, { left: ix + 58 * k, top: bottom(l1), width: (cardW - cardIn * 2) / 2 - 64 * k, size: 28 * k, weight: 800, color: "#FFFFFF", lh: 1.05 });
    rowH = Math.max(rowH, bottom(l2) - cy);
  }
  cy += rowH;
  card.set({ height: cy - cardTop + cardIn });
  y = cardTop + card.height! + 32 * k;

  // Apply panel
  const panelW = Math.min(cardW - 180 * k, W * 0.5);
  const panel = R(x, { left, top: y, width: panelW, height: 100, rx: 34, fill: rgba("#FFFFFF", 0.08), stroke: rgba("#FFFFFF", 0.14), strokeWidth: 2, name: "Glass card" });
  const pl = T(x, `${c.cta}: send your CV or scan`, { left: left + 30, top: y + 26 * k, width: panelW - 60, size: 24 * k, font: FONTS.body, weight: 500, color: "#F2F7FF", align: "center" });
  const btn = pill(x, c.contact || c.link, { left: 0, top: 0, size: 26 * k, fill: grad(x, [[0, light], [1, mixHex(b.accent, "#FFFFFF", 0.1)]], "h"), color: mixHex(b.primary, "#000000", 0.4), icon: "mail", radius: 30, padY: 22 * k, name: "Apply button" });
  const bx = left + Math.max(20, (panelW - btn.w) / 2);
  const by = bottom(pl) + 18 * k;
  const g = await btn.place();
  g.set({ left: bx, top: by });
  if (btn.w > panelW - 40) g.scaleToWidth(panelW - 40);
  panel.set({ height: by + g.getScaledHeight() + 28 * k - y });
  await qr(x, { left: left + panelW + 26, top: y + (panel.height! - 150 * k) / 2, size: 150 * k });
  return bottom(panel);
}

// ---------- 2. Studio (light, big "Hiring", outlined job pill, classic chair) ----------
async function studio(x: Ctx, k: number) {
  const { W, H, c, b, v } = x;
  const pad = 72;
  const ink = mixHex(b.primary, "#0B1118", 0.6);
  bg(x, grad(x, [[0, "#FFFFFF"], [1, mixHex(b.primary, "#FFFFFF", 0.92)]]));
  const sw = new x.F.Path(`M${W * 0.62} ${H * 0.2} C ${W * 0.7} ${H * 0.05}, ${W * 0.88} ${H * 0.02}, ${W + 20} ${H * 0.01} M${W * 0.9} ${H * 0.36} C ${W * 0.86} ${H * 0.26}, ${W * 0.93} ${H * 0.18}, ${W + 20} ${H * 0.16}`, { fill: "", stroke: rgba(b.primary, 0.35), strokeWidth: 10, strokeLineCap: "round" });
  (sw as Obj & { name?: string }).name = "Line";
  x.objs.push(sw);
  const artKind = v.art === "megaphone" ? "megaphone" : "chair";
  const artW = W * (H > 1500 ? 0.5 : 0.42);
  await art(x, artKind, b.primary, { left: v.flip ? -W * 0.02 : W - artW - 10, top: H - artW * (artKind === "megaphone" ? 0.8 : 1.5) - 30, width: artW, flip: v.flip });
  await logoMark(x, false, { left: W / 2 - 165, top: 52, size: 70 });
  wordmark(x, false, { left: W / 2 - 85, top: 64, size: 38, width: 260 });
  const left = v.flip ? W * 0.42 : pad;
  const tw = W - left - pad;
  let y = H * 0.16;
  const kk = T(x, c.kicker || "We Are", { left, top: y, width: tw, size: 72 * k, weight: 700, color: b.primary, lh: 1 });
  y = bottom(kk);
  const big = c.headline || "Hiring";
  const h1 = T(x, big, { left, top: y, width: W - left - pad, size: bigSize(big, 250 * k, (v.flip ? W * 0.55 : W - 2 * pad - 60), 0.6), weight: 900, color: b.primary, lh: 0.95, spacing: -30 });
  y = bottom(h1) + 8 * k;
  if (c.tagline) {
    const tg = T(x, c.tagline, { left, top: y, width: Math.min(tw, 560), size: 42 * k, weight: 600, color: ink });
    R(x, { left: left + Math.min(used(tg), 520) + 26, top: y + 26 * k, width: 120, height: 3, fill: ink, name: "Line" });
    y = bottom(tg);
  }
  y += 40 * k;
  if (c.label) y = bottom(T(x, c.label, { left, top: y, width: tw, size: 36 * k, weight: 800, color: b.primary })) + 12 * k;
  const jt = T(x, c.title, { left: left + 30, top: y + 14 * k, width: Math.min(tw, 600) - 60, size: 38 * k, weight: 600, color: ink });
  R(x, { left, top: y, width: Math.min(used(jt), 540) + 60, height: jt.getScaledHeight() + 28 * k, rx: 22, fill: "", stroke: ink, strokeWidth: 3, name: "Outline" });
  C(x, { left: left - 11, top: y + (jt.getScaledHeight() + 28 * k) / 2 - 11, radius: 11, fill: b.primary, name: "Dot" });
  x.objs.push(x.objs.splice(x.objs.indexOf(jt), 1)[0]);
  y += jt.getScaledHeight() + 28 * k + 16 * k;
  if (c.points.length) y = bottom(T(x, bullets(c.points), { left: left + 6, top: y, width: Math.min(tw, 600), size: 27 * k, font: FONTS.body, weight: 500, color: ink, lh: 1.35 })) + 30 * k;
  await qr(x, { left, top: y, size: 128, border: b.primary });
  const a1 = T(x, `${c.cta}:`, { left: left + 150, top: y + 6, width: 440, size: 32, weight: 600, color: ink });
  const a2 = T(x, c.contact || c.link, { left: left + 150, top: bottom(a1), width: 440, size: 30, weight: 800, color: b.primary });
  T(x, c.link, { left: left + 150, top: bottom(a2) + 4, width: 440, size: 20, font: FONTS.body, weight: 500, color: ink });
  y += 150;
  if (c.footer) {
    const p = pill(x, c.footer, { left, top: y, size: 28, fill: b.primary, color: "#FFFFFF", radius: 18, weight: 600, name: "Website button" });
    const g = await p.place();
    y = bottom(g);
  }
  return y;
}

// ---------- 3. Stripe (off-white, brand stripe, megaphone, round badge) ----------
async function stripe(x: Ctx, k: number) {
  const { W, H, c, b } = x;
  const ink = "#121820";
  bg(x, "#F4F4F1");
  const band = new x.F.Polygon([{ x: 0, y: 0 }, { x: W * 0.4, y: 0 }, { x: W * 0.44, y: H * 0.79 }, { x: W, y: H }, { x: 0, y: H }], { fill: b.primary });
  (band as Obj & { name?: string }).name = "Stripe";
  x.objs.push(band);
  await art(x, "megaphone", b.primary, { left: -30, top: H * (H > 1500 ? 0.36 : 0.3), width: W * 0.56 });
  C(x, { left: W - 60 - 176, top: 56, radius: 88, fill: b.primary, name: "Badge" });
  await logoMark(x, true, { left: W - 60 - 134, top: 76, size: 92 });
  wordmark(x, true, { left: W - 60 - 176, top: 172, size: 20, width: 176, align: "center" });
  const left = W * 0.5;
  const tw = W - left - 60;
  let y = 270;
  const kk = T(x, c.kicker || "We Are", { left: left - 8, top: y, width: tw, size: 120 * k, font: FONTS.script, weight: 400, color: ink, lh: 1 });
  y = bottom(kk) - 10;
  const big = c.headline || "Hiring";
  y = bottom(T(x, big, { left, top: y, width: tw + 40, size: bigSize(big, 170 * k, tw, 0.64), weight: 900, color: b.primary, lh: 0.95, spacing: -30 }));
  if (c.tagline) y = bottom(T(x, c.tagline, { left, top: y, width: tw, size: 44 * k, weight: 700, color: ink }));
  y += 28 * k;
  if (c.label) {
    const p = pill(x, c.label, { left, top: y, size: 32 * k, fill: b.primary, color: "#FFFFFF", radius: 0, weight: 700, name: "Label box" });
    y = bottom(await p.place()) + 20 * k;
  }
  y = bottom(T(x, c.title.toUpperCase(), { left, top: y, width: tw, size: 34 * k, weight: 800, color: ink })) + 12 * k;
  if (c.points.length) y = bottom(T(x, bullets(c.points), { left, top: y, width: tw, size: 27 * k, font: FONTS.body, weight: 500, color: ink, lh: 1.35 })) + 30 * k;
  const ab = pill(x, c.cta, { left, top: y, size: 34 * k, fill: b.primary, color: "#FFFFFF", icon: "mail", name: "Apply button" });
  y = bottom(await ab.place()) + 12 * k;
  if (c.contact) y = bottom(T(x, c.contact, { left, top: y, width: tw, size: 28 * k, weight: 700, color: ink })) + 16 * k;
  await qr(x, { left, top: y, size: 96, border: b.primary });
  T(x, `Scan to apply\n${c.link}`, { left: left + 112, top: y + 18, width: tw - 112, size: 20, font: FONTS.body, weight: 500, color: ink });
  y += 100;
  if (c.footer) {
    await I(x, svgUrl(iconSvg("globe", "#FFFFFF", 64)), { left: 64, top: H - 92, width: 32, name: "Icon" });
    T(x, c.footer, { left: 106, top: H - 92, width: 500, size: 28, font: FONTS.body, weight: 700, color: "#FFFFFF" });
  }
  return y + H * 0.21; // the text column must stay above the diagonal
}

// ---------- 4. Bold (full brand colour, script + big caps, chair with "?") ----------
async function bold(x: Ctx, k: number) {
  const { W, H, c, b, v } = x;
  const pad = 66;
  const light = mixHex(b.accent, "#FFFFFF", 0.45);
  bg(x, grad(x, [[0, mixHex(b.primary, "#FFFFFF", 0.12)], [0.45, b.primary], [1, mixHex(b.primary, "#000000", 0.3)]], "d"));
  T(x, "JOIN", { left: W + 90, top: H * 0.06, width: H * 0.9, size: 400, weight: 900, color: rgba(light, 0.13) as string, angle: 90, name: "Background word" });
  const footH = 150;
  const chairW = (H > 1500 ? 0.27 : 0.31) * H;
  await art(x, "chair", mixHex(b.primary, "#0B0F14", 0.72), { left: W - 30 - chairW, top: H - footH - 10 - chairW * 1.5, width: chairW });
  T(x, "?", { left: W - 30 - chairW * 0.78, top: H - footH - chairW * 1.5, width: chairW * 0.6, size: chairW * 0.78, weight: 900, color: light, name: "Question mark" });
  if (c.footer) {
    await I(x, svgUrl(iconSvg("globe", "#FFFFFF", 64)), { left: pad, top: pad, width: 28, name: "Icon" });
    T(x, c.footer, { left: pad + 38, top: pad - 2, width: 420, size: 24, font: FONTS.body, weight: 500, color: "#FFFFFF" });
  }
  if (c.contact) {
    await I(x, svgUrl(iconSvg("mail", "#FFFFFF", 64)), { left: W - pad - 440, top: pad, width: 28, name: "Icon" });
    T(x, c.contact, { left: W - pad - 402, top: pad - 2, width: 402, size: 24, font: FONTS.body, weight: 500, color: "#FFFFFF" });
  }
  const tw = 590;
  let y = pad + 70;
  y = bottom(T(x, c.kicker || "We are", { left: pad, top: y, width: tw, size: 128 * k, font: FONTS.script, weight: 400, color: "#FFFFFF", lh: 1 })) - 12;
  const head = (c.headline || "Hiring").toUpperCase();
  y = bottom(T(x, head, { left: pad, top: y, width: tw, size: Math.max(bigSize(head, 150 * k, tw, 0.72), 70 * k), weight: 900, color: "#FFFFFF", lh: 0.95 }));
  if (c.tagline) y = bottom(T(x, c.tagline, { left: pad, top: y + 14 * k, width: tw, size: 42 * k, weight: 700, color: light }));
  if (c.intro) y = bottom(T(x, c.intro, { left: pad, top: y + 8 * k, width: tw - 60, size: 25 * k, font: FONTS.body, weight: 500, color: rgba("#FFFFFF", 0.85) as string, lh: 1.3 }));
  y += 32 * k;
  if (c.label) y = bottom(T(x, c.label.toUpperCase(), { left: pad, top: y, width: tw, size: 24 * k, weight: 700, color: light, spacing: 120 }));
  await I(x, svgUrl(iconSvg("arrow", light, 64)), { left: pad, top: y + 10 * k, width: 46 * k, name: "Icon" });
  y = bottom(T(x, c.title, { left: pad + 60 * k, top: y, width: tw - 70, size: 54 * k, weight: 800, color: "#FFFFFF", lh: 1.08 }));
  if (c.points.length) {
    y = bottom(T(x, "Job details:", { left: pad, top: y + 24 * k, width: tw, size: 32 * k, weight: 700, color: "#FFFFFF" })) + 8 * k;
    y = bottom(T(x, bullets(c.points, "›"), { left: pad, top: y, width: tw, size: 26 * k, font: FONTS.body, weight: 500, color: "#FFFFFF", lh: 1.4 }));
  }
  const ab = pill(x, c.cta, { left: pad, top: y + 30 * k, size: 34, fill: light, color: mixHex(b.primary, "#000000", 0.3), radius: 12, icon: "arrow", name: "Apply button" });
  y = bottom(await ab.place());
  R(x, { left: 0, top: H - footH, width: W, height: footH, fill: rgba("#000000", 0.18), name: "Footer bar" });
  await logoMark(x, true, { left: pad, top: H - footH + 38, size: 72 });
  wordmark(x, true, { left: pad + 86, top: H - footH + 56, size: 34, width: 260 });
  T(x, `Scan to apply\n${c.link}`, { left: W - pad - 540, top: H - footH + 46, width: 420, size: 21, font: FONTS.body, weight: 500, color: "#FFFFFF", align: "right" });
  await qr(x, { left: W - pad - 104, top: H - footH + 23, size: 104 });
  void v;
  return y + footH + 20;
}

// ---------- 5. Announcement (deep brand colour, centred, megaphone with waves) ----------
async function spotlight(x: Ctx, k: number) {
  const { W, H, c, b } = x;
  const light = mixHex(b.accent, "#FFFFFF", 0.45);
  bg(x, grad(x, [[0, mixHex(b.primary, "#FFFFFF", 0.06)], [0.55, mixHex(b.primary, "#000000", 0.3)], [1, mixHex(b.primary, "#000000", 0.55)]]));
  C(x, { left: -W * 0.25, top: H - W * 0.65, radius: W * 0.55, fill: "", stroke: rgba(light, 0.09), strokeWidth: 50, name: "Ring" });
  C(x, { left: -W * 0.05, top: H - W * 0.45, radius: W * 0.35, fill: "", stroke: rgba(light, 0.11), strokeWidth: 30, name: "Ring" });
  await logoMark(x, true, { left: W / 2 - 160, top: 60, size: 72 });
  wordmark(x, true, { left: W / 2 - 75, top: 76, size: 36, width: 260 });
  const tw = 900;
  const L = (W - tw) / 2;
  let y = 190;
  y = bottom(T(x, c.kicker || "We Are", { left: L, top: y, width: tw, size: 124 * k, font: FONTS.script, weight: 400, color: light, align: "center", lh: 1 })) - 12;
  const head = (c.headline || "Hiring").toUpperCase();
  y = bottom(T(x, head, { left: L, top: y, width: tw, size: Math.max(bigSize(head, 170 * k, tw, 0.72), 80 * k), weight: 900, color: "#FFFFFF", align: "center", lh: 0.95 }));
  if (c.tagline) y = bottom(T(x, c.tagline, { left: L, top: y + 12 * k, width: tw, size: 40 * k, weight: 600, color: rgba("#FFFFFF", 0.92) as string, align: "center" }));
  y += 36 * k;
  if (c.label) {
    const p = pill(x, c.label.toUpperCase(), { left: 0, top: y, size: 26 * k, fill: "", color: light, weight: 700, name: "Label" });
    (p.parts[0] as Fab.Rect).set({ stroke: light, strokeWidth: 3 });
    const g = await p.place();
    g.set({ left: (W - g.getScaledWidth()) / 2 });
    y = bottom(g) + 14 * k;
  }
  y = bottom(T(x, c.title, { left: L, top: y, width: tw, size: 62 * k, weight: 800, color: "#FFFFFF", align: "center", lh: 1.08 }));
  if (c.intro) y = bottom(T(x, c.intro, { left: L + 50, top: y + 12 * k, width: tw - 100, size: 26 * k, font: FONTS.body, weight: 500, color: rgba("#FFFFFF", 0.8) as string, align: "center", lh: 1.35 }));
  if (c.points.length) {
    y += 26 * k;
    const chips = await Promise.all(c.points.map((p) => pill(x, p, { left: 0, top: 0, size: 24 * k, fill: rgba("#FFFFFF", 0.1) as string, color: "#FFFFFF", weight: 700, name: "Tag" })));
    const rows: (typeof chips)[] = [[]];
    let rw = 0;
    for (const ch of chips) {
      if (rw + ch.w > tw && rows[rows.length - 1].length) {
        rows.push([]);
        rw = 0;
      }
      rows[rows.length - 1].push(ch);
      rw += ch.w + 12;
    }
    for (const row of rows) {
      const total = row.reduce((s, ch) => s + ch.w, 0) + (row.length - 1) * 12;
      let cx = (W - total) / 2;
      for (const ch of row) {
        (ch.parts[0] as Fab.Rect).set({ stroke: light, strokeWidth: 2 });
        const g = await ch.place();
        g.set({ left: cx, top: y });
        cx += ch.w + 12;
      }
      y += row[0].h + 12;
    }
  }
  const megaW = (H > 1500 ? 560 : H > 1200 ? 470 : 400);
  await art(x, "megaphone", b.accent, { left: -20, top: H - 40 - megaW * 0.8, width: megaW, waves: true });
  const ab = pill(x, c.cta, { left: 0, top: 0, size: 34, fill: light, color: mixHex(b.primary, "#000000", 0.35), icon: "arrow", name: "Apply button" });
  const g = await ab.place();
  const bx = W - 64 - 130 - g.getScaledWidth();
  g.set({ left: bx, top: H - 230 });
  if (c.contact) T(x, c.contact, { left: bx - 100, top: H - 230 + g.getScaledHeight() + 10, width: g.getScaledWidth() + 100, size: 26, font: FONTS.body, weight: 700, color: "#FFFFFF", align: "right" });
  T(x, [c.footer, c.link].filter(Boolean).join(" · "), { left: bx - 300, top: H - 230 + g.getScaledHeight() + 46, width: g.getScaledWidth() + 300, size: 20, font: FONTS.body, weight: 500, color: rgba("#FFFFFF", 0.75) as string, align: "right" });
  await qr(x, { left: W - 64 - 112, top: H - 230, size: 112 });
  return y + 250;
}

// ---------- LinkedIn (wide) version of every design ----------
async function wide(x: Ctx, kind: DesignId, k: number) {
  const { W, H, c, b, v } = x;
  const light = mixHex(b.accent, "#FFFFFF", 0.45);
  const lightBg = kind === "studio" || kind === "stripe";
  const ink = lightBg ? mixHex(b.primary, "#0B1118", 0.6) : "#FFFFFF";
  if (kind === "studio") bg(x, grad(x, [[0, "#FFFFFF"], [1, mixHex(b.primary, "#FFFFFF", 0.92)]]));
  else if (kind === "stripe") {
    bg(x, "#F4F4F1");
    const band = new x.F.Polygon([{ x: W * 0.66, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: W * 0.74, y: H }], { fill: b.primary });
    (band as Obj & { name?: string }).name = "Stripe";
    x.objs.push(band);
  } else bg(x, grad(x, [[0, mixHex(b.primary, "#FFFFFF", 0.08)], [0.5, b.primary], [1, mixHex(b.primary, "#000000", 0.4)]], "d"));
  if (kind === "glass") C(x, { left: W * 0.5, top: -H * 0.2, radius: H * 0.8, fill: radial(x, b.accent, 0.35), name: "Glow" });
  const artKind = kind === "stripe" || kind === "spotlight" ? "megaphone" : kind === "glass" ? (v.art === "megaphone" ? "megaphone" : "mesh") : "chair";
  const aw = artKind === "megaphone" ? 420 : artKind === "mesh" ? 330 : 280;
  await art(x, artKind, kind === "bold" ? mixHex(b.primary, "#0B0F14", 0.72) : kind === "glass" ? mixHex(b.accent, "#FFFFFF", 0.15) : b.primary, { left: W - aw - 40, top: H - aw * (artKind === "megaphone" ? 0.8 : artKind === "mesh" ? 1.23 : 1.5) - 10, width: aw, waves: kind === "spotlight" });
  await logoMark(x, !lightBg || kind === "stripe", { left: W - 280, top: 30, size: 52 });
  wordmark(x, !lightBg || kind === "stripe", { left: W - 218, top: 42, size: 26, width: 190 });
  const L = 56;
  const tw = 640;
  let y = 40;
  const script = kind === "studio" || kind === "glass" ? FONTS.head : FONTS.script;
  y = bottom(T(x, c.kicker || "We Are", { left: L, top: y, width: tw, size: (script === FONTS.script ? 76 : 50) * k, font: script, weight: script === FONTS.script ? 400 : 800, color: kind === "studio" ? b.primary : kind === "spotlight" ? light : ink, lh: 1 }));
  const head = kind === "bold" || kind === "spotlight" ? (c.headline || "Hiring").toUpperCase() : c.headline || "Hiring";
  y = bottom(T(x, head, { left: L, top: y, width: tw + 80, size: bigSize(head, 130 * k, tw, 0.66), weight: 900, color: lightBg ? b.primary : "#FFFFFF", lh: 0.95, spacing: -20 }));
  if (c.tagline) y = bottom(T(x, c.tagline, { left: L, top: y + 4, width: tw, size: 30 * k, weight: 700, color: kind === "bold" ? light : ink }));
  y += 16;
  const t = T(x, c.title, { left: L, top: y, width: tw, size: 36 * k, weight: 800, color: ink });
  y = bottom(t) + 8;
  const meta = [c.workMode, c.salary, c.place].filter(Boolean).join("  ·  ");
  y = bottom(T(x, meta, { left: L, top: y, width: tw, size: 21 * k, font: FONTS.body, weight: 500, color: ink })) + 20;
  const ab = pill(x, c.cta, { left: L, top: y, size: 24, fill: lightBg ? b.primary : light, color: lightBg ? "#FFFFFF" : mixHex(b.primary, "#000000", 0.35), icon: "arrow", name: "Apply button" });
  const g = await ab.place();
  await qr(x, { left: L + g.getScaledWidth() + 20, top: y - 10, size: 70, border: lightBg ? b.primary : undefined });
  T(x, [c.contact, c.link].filter(Boolean).join("\n"), { left: L + g.getScaledWidth() + 104, top: y - 4, width: 300, size: 17, font: FONTS.body, weight: 700, color: ink });
  return Math.max(bottom(g), y + 60);
}

// ---------- 6. Generated design ("New variation"): a fresh mix of layout, theme and decoration ----------
const dotsSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">${Array.from({ length: 64 }, (_, i) => `<circle cx="${(i % 8) * 52 + 26}" cy="${Math.floor(i / 8) * 52 + 26}" r="6" fill="${color}"/>`).join("")}</svg>`;

async function custom(x: Ctx, k: number) {
  const { W, H, c, b } = x;
  const g = x.v.gen ?? randomGen();
  const pad = 72;
  const deep = mixHex(b.primary, "#000000", 0.5);
  const T_ = {
    dark: { ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)", hi: "#FFFFFF", em: mixHex(b.accent, "#FFFFFF", 0.5), btn: mixHex(b.accent, "#FFFFFF", 0.5), btnInk: deep, cardFill: "rgba(255,255,255,0.08)", cardLine: "rgba(255,255,255,0.18)", solid: mixHex(b.primary, "#FFFFFF", 0.12), logoWhite: true },
    light: { ink: mixHex(b.primary, "#0B1118", 0.6), soft: mixHex(b.primary, "#5B6878", 0.6), hi: b.primary, em: b.accent, btn: b.primary, btnInk: "#FFFFFF", cardFill: "#FFFFFF", cardLine: mixHex(b.primary, "#FFFFFF", 0.75), solid: mixHex(b.primary, "#FFFFFF", 0.92), logoWhite: false },
    accent: { ink: "#FFFFFF", soft: "rgba(255,255,255,0.88)", hi: "#FFFFFF", em: mixHex(b.accent, "#FFFFFF", 0.7), btn: "#FFFFFF", btnInk: b.primary, cardFill: "rgba(255,255,255,0.12)", cardLine: "rgba(255,255,255,0.28)", solid: mixHex(b.primary, b.accent, 0.4), logoWhite: true },
  }[g.theme];
  const light = g.theme === "light";

  // Background
  if (g.theme === "dark") bg(x, grad(x, [[0, mixHex(b.primary, "#FFFFFF", 0.08)], [0.5, b.primary], [1, deep]], "d"));
  else if (light) bg(x, grad(x, [[0, "#FFFFFF"], [1, mixHex(b.primary, "#FFFFFF", 0.9)]]));
  else bg(x, grad(x, [[0, b.accent], [0.55, mixHex(b.primary, b.accent, 0.45)], [1, b.primary]], "d"));
  const artSide = g.art === "none" ? "bottom" : g.artPos;
  if (g.bg === "split") {
    const pts =
      artSide === "bottom"
        ? [{ x: 0, y: H * 0.62 }, { x: W, y: H * 0.5 }, { x: W, y: H }, { x: 0, y: H }]
        : artSide === "right"
          ? [{ x: W * 0.62, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: W * 0.5, y: H }]
          : [{ x: 0, y: 0 }, { x: W * 0.38, y: 0 }, { x: W * 0.5, y: H }, { x: 0, y: H }];
    const poly = new x.F.Polygon(pts, { fill: light ? mixHex(b.primary, "#FFFFFF", 0.85) : rgba("#FFFFFF", 0.07) });
    (poly as Obj & { name?: string }).name = "Shape";
    x.objs.push(poly);
  } else if (g.bg === "circles") {
    C(x, { left: W * 0.35, top: -H * 0.15, radius: W * 0.5, fill: radial(x, light ? b.accent : mixHex(b.accent, "#FFFFFF", 0.3), light ? 0.22 : 0.45), name: "Glow" });
    C(x, { left: -W * 0.3, top: H * 0.55, radius: W * 0.45, fill: radial(x, light ? b.primary : b.accent, 0.25), name: "Glow" });
  } else if (g.bg === "arch") {
    const aw = W * 0.5;
    const ax = artSide === "left" ? -aw * 0.1 : artSide === "bottom" ? (W - aw) / 2 : W - aw * 0.9;
    R(x, { left: ax, top: H * 0.38, width: aw, height: H, rx: aw / 2, fill: light ? mixHex(b.primary, "#FFFFFF", 0.82) : rgba("#FFFFFF", 0.09), name: "Arch" });
  } else if (g.bg === "dots") {
    await I(x, svgUrl(dotsSvg(light ? rgba(b.primary, 0.18) : rgba("#FFFFFF", 0.14))), { left: artSide === "left" ? W - 380 : 30, top: H - 420, width: 360, name: "Dots" });
    await I(x, svgUrl(dotsSvg(light ? rgba(b.accent, 0.2) : rgba("#FFFFFF", 0.1))), { left: artSide === "left" ? 20 : W - 300, top: 40, width: 260, name: "Dots" });
  }
  if (g.deco.includes("bgword")) T(x, "HIRING", { left: -20, top: H * 0.42, width: W + 400, size: 300, weight: 900, color: light ? rgba(b.primary, 0.06) : rgba("#FFFFFF", 0.07), name: "Background word" });
  if (g.deco.includes("rings")) {
    C(x, { left: W * 0.62, top: -W * 0.18, radius: W * 0.3, fill: "", stroke: light ? rgba(b.accent, 0.25) : rgba("#FFFFFF", 0.12), strokeWidth: 26, name: "Ring" });
    C(x, { left: -W * 0.12, top: H * 0.7, radius: W * 0.18, fill: "", stroke: light ? rgba(b.primary, 0.15) : rgba("#FFFFFF", 0.1), strokeWidth: 18, name: "Ring" });
  }
  if (g.deco.includes("swoosh")) {
    const sw = new x.F.Path(`M${W * 0.55} ${H * 0.16} C ${W * 0.68} ${H * 0.02}, ${W * 0.86} ${H * 0.0}, ${W + 30} ${H * 0.02}`, { fill: "", stroke: light ? rgba(b.accent, 0.5) : rgba("#FFFFFF", 0.3), strokeWidth: 12, strokeLineCap: "round" });
    (sw as Obj & { name?: string }).name = "Line";
    x.objs.push(sw);
  }

  // Picture
  let limit = H - 40;
  let colL = pad;
  let colW = W - pad * 2;
  if (g.art !== "none") {
    const artColor = g.art === "megaphone" ? b.accent : light ? b.primary : g.theme === "accent" ? mixHex(b.primary, "#000000", 0.2) : mixHex(b.accent, "#FFFFFF", 0.15);
    const ratio = g.art === "megaphone" ? 0.8 : g.art === "mesh" ? 1.23 : 1.5;
    if (artSide === "bottom") {
      const aw = Math.min(W * 0.5, (H * 0.34) / ratio);
      await art(x, g.art, artColor, { left: g.center ? (W - aw) / 2 : W - aw - 40, top: H - aw * ratio - 20, width: aw, waves: true });
      limit = H - aw * ratio * 0.85;
    } else {
      const aw = Math.min(W * (g.art === "megaphone" ? 0.56 : 0.5), (H * 0.6) / ratio);
      const left = artSide === "right" ? W - aw * (g.art === "megaphone" ? 0.95 : 0.9) : -aw * 0.1;
      await art(x, g.art, artColor, { left, top: H - aw * ratio - 18, width: aw, flip: artSide === "left", waves: g.art === "megaphone" });
      colW = W * 0.57 - pad;
      colL = artSide === "left" ? W - pad - colW : pad;
    }
  }
  if (g.deco.includes("bubbles")) {
    await I(x, svgUrl(bubbleSvg(b.accent, "heart")), { left: artSide === "left" ? W * 0.08 : W * 0.78, top: H * 0.2, width: 160, angle: 10, opacity: 0.92, name: "Bubble" });
    await I(x, svgUrl(bubbleSvg(b.accent, "like")), { left: artSide === "left" ? W * 0.32 : W * 0.6, top: H * 0.48, width: 120, angle: -12, opacity: 0.88, name: "Bubble" });
  }
  if (g.deco.includes("stars")) {
    for (const [sx, sy, sz] of [[0.86, 0.1, 54], [0.92, 0.2, 30], [0.06, 0.36, 36]] as const) await I(x, svgUrl(starSvg(light ? b.accent : T_.em)), { left: W * sx, top: H * sy, width: sz, name: "Star" });
  }
  const center = g.center && artSide === "bottom";
  const align = center ? "center" : "left";
  if (g.cta === "bar") limit = Math.min(limit, H - 170);

  // Logo
  if (center) {
    await logoMark(x, T_.logoWhite, { left: W / 2 - 160, top: 56, size: 68 });
    wordmark(x, T_.logoWhite, { left: W / 2 - 80, top: 70, size: 36, width: 260 });
  } else {
    await logoMark(x, T_.logoWhite, { left: colL, top: 56, size: 64 });
    wordmark(x, T_.logoWhite, { left: colL + 78, top: 68, size: 34, width: 260 });
  }
  let y = H > 1500 ? H * 0.12 : 170 * Math.min(1, k);

  // Headline
  const kick = c.kicker || "We're";
  const big = c.headline || "Hiring";
  if (g.head === "stack") {
    y = bottom(T(x, kick, { left: colL, top: y, width: colW, size: 120 * k, weight: 800, color: T_.ink, align, lh: 0.95 })) - 8 * k;
    y = bottom(T(x, big, { left: colL, top: y, width: colW + (center ? 0 : 120), size: bigSize(big, 260 * k, colW + 60, 0.6), weight: 900, color: T_.hi, align, lh: 0.92, spacing: -25 }));
  } else if (g.head === "script") {
    y = bottom(T(x, kick, { left: colL, top: y, width: colW, size: 130 * k, font: FONTS.script, weight: 400, color: light ? b.accent : T_.em, align, lh: 1 })) - 16 * k;
    const head = big.toUpperCase();
    y = bottom(T(x, head, { left: colL, top: y, width: colW, size: bigSize(head, 190 * k, colW, 0.72), weight: 900, color: T_.hi, align, lh: 0.95 }));
  } else if (g.head === "band") {
    y = bottom(T(x, kick.toUpperCase(), { left: colL, top: y, width: colW, size: 40 * k, weight: 800, color: light ? b.accent : T_.em, align, spacing: 300 })) + 14 * k;
    const head = big.toUpperCase();
    const size = bigSize(head, 170 * k, colW - 60, 0.72);
    const probe = new x.F.Textbox(head, { width: 3000, fontSize: size, fontFamily: FONTS.head, fontWeight: 900 });
    const bw = center ? colW : Math.min(colW, used(probe) + 60);
    R(x, { left: center ? colL : colL, top: y, width: bw, height: size * 0.95 + 40 * k, rx: 18, fill: light ? b.primary : "#FFFFFF", name: "Headline band" });
    T(x, head, { left: colL + 30, top: y + 20 * k, width: bw - 60, size, weight: 900, color: light ? "#FFFFFF" : b.primary, align, lh: 0.95 });
    y += size * 0.95 + 40 * k;
  } else {
    y = bottom(T(x, kick, { left: colL, top: y, width: colW, size: 90 * k, weight: 800, color: T_.ink, align, lh: 1 }));
    const head = big.toUpperCase();
    const ot = T(x, head, { left: colL, top: y, width: colW + (center ? 0 : 80), size: bigSize(head, 200 * k, colW, 0.74), weight: 900, color: "rgba(0,0,0,0)", align, lh: 0.95 });
    ot.set({ stroke: light ? b.primary : "#FFFFFF", strokeWidth: 4 });
    y = bottom(ot);
  }
  if (c.tagline) y = bottom(T(x, c.tagline, { left: colL, top: y + 12 * k, width: colW, size: 36 * k, weight: 600, color: T_.soft, align }));
  y += 30 * k;

  // Job title (+ work type)
  if (g.title === "pill") {
    const p = pill(x, c.title, { left: colL, top: y, size: 38 * k, fill: light ? mixHex(b.primary, "#FFFFFF", 0.9) : "rgba(255,255,255,0.14)", color: T_.ink, radius: 18, weight: 800, name: "Job title" });
    const gt = await p.place();
    if (gt.getScaledWidth() > colW) gt.scaleToWidth(colW);
    if (center) gt.set({ left: (W - gt.getScaledWidth()) / 2 });
    y = bottom(gt);
  } else {
    const off = g.title === "dot" && !center ? 50 * k : 0;
    if (off) C(x, { left: colL, top: y + 22 * k, radius: 15 * k, fill: light ? b.accent : T_.em, name: "Dot" });
    y = bottom(T(x, c.title, { left: colL + off, top: y, width: colW - off, size: 58 * k, weight: 800, color: T_.ink, align, lh: 1.05 }));
  }
  if (c.workMode) {
    const wp = pill(x, c.workMode, { left: colL, top: y + 12 * k, size: 26 * k, fill: light ? b.accent : T_.em, color: light ? "#FFFFFF" : deep, angle: center ? 0 : -6, name: "Work type tag" });
    const wg = await wp.place();
    if (center) wg.set({ left: (W - wg.getScaledWidth()) / 2 });
    y = bottom(wg);
  }
  y += 30 * k;

  // Details: requirements or key points, then location + salary
  const useReq = g.list === "requirements" && c.requirements.length > 0;
  const items = (useReq ? c.requirements : c.points).slice(0, 5);
  const inPad = g.card === "none" ? 0 : 40 * k;
  const cardTop = y;
  let card: Fab.Rect | null = null;
  if (g.card !== "none") card = R(x, { left: colL, top: cardTop, width: colW, height: 100, rx: 28, fill: g.card === "glass" ? T_.cardFill : g.card === "solid" ? T_.solid : "", stroke: g.card === "solid" ? "" : T_.cardLine, strokeWidth: g.card === "solid" ? 0 : 2, name: "Card" });
  let cy = cardTop + inPad;
  cy = bottom(T(x, useReq ? "Requirements" : "Job details", { left: colL + inPad, top: cy, width: colW - inPad * 2, size: 42 * k, weight: 800, color: light ? b.primary : T_.em, align })) + 12 * k;
  cy = bottom(T(x, center ? items.join("   •   ") : bullets(items), { left: colL + inPad, top: cy, width: colW - inPad * 2, size: 27 * k, font: FONTS.body, weight: 500, color: T_.ink, align, lh: center ? 1.5 : 1.3 })) + 22 * k;
  const info = [
    { icon: "pin", label: "Location", value: c.place || c.workMode },
    { icon: "money", label: "Salary", value: c.salary },
  ].filter((i) => i.value);
  let rowH = 0;
  const half = (colW - inPad * 2) / 2;
  for (const [i, it] of info.entries()) {
    const ix = center ? colL + inPad + i * half + half / 2 - 130 : colL + inPad + i * half;
    await I(x, svgUrl(iconSvg(it.icon, light ? b.accent : T_.em, 64)), { left: ix, top: cy + 4, width: 40 * k, name: "Icon" });
    const l1 = T(x, `${it.label}:`, { left: ix + 52 * k, top: cy, width: half - 60 * k, size: 20 * k, font: FONTS.body, weight: 500, color: T_.soft });
    const l2 = T(x, it.value, { left: ix + 52 * k, top: bottom(l1), width: half - 60 * k, size: 26 * k, weight: 800, color: T_.ink, lh: 1.05 });
    rowH = Math.max(rowH, bottom(l2) - cy);
  }
  cy += rowH;
  if (card) card.set({ height: cy - cardTop + inPad });
  y = cy + inPad + 28 * k;

  // How to apply
  if (g.cta === "bar") {
    R(x, { left: 0, top: H - 150, width: W, height: 150, fill: light ? b.primary : "rgba(0,0,0,0.22)", name: "Footer bar" });
    const ab = pill(x, c.cta, { left: pad, top: H - 115, size: 30, fill: light ? "#FFFFFF" : T_.btn, color: light ? b.primary : T_.btnInk, icon: "arrow", name: "Apply button" });
    const gb = await ab.place();
    T(x, [c.contact, c.link].filter(Boolean).join("\n"), { left: pad + gb.getScaledWidth() + 24, top: H - 112, width: W - pad * 2 - gb.getScaledWidth() - 170, size: 22, font: FONTS.body, weight: 700, color: "#FFFFFF" });
    await qr(x, { left: W - pad - 110, top: H - 130, size: 110 });
  } else if (g.cta === "box") {
    const bw = Math.min(colW, 620);
    const bx = center ? (W - bw) / 2 : colL;
    const box = R(x, { left: bx, top: y, width: bw, height: 170, rx: 26, fill: light ? b.primary : "rgba(255,255,255,0.12)", stroke: light ? "" : T_.cardLine, strokeWidth: light ? 0 : 2, name: "Apply box" });
    await qr(x, { left: bx + 24, top: y + 24, size: 122 });
    const t1 = T(x, c.cta, { left: bx + 168, top: y + 26, width: bw - 190, size: 40, weight: 800, color: "#FFFFFF" });
    T(x, [c.contact, c.link].filter(Boolean).join("\n"), { left: bx + 168, top: bottom(t1) + 6, width: bw - 190, size: 21, font: FONTS.body, weight: 500, color: "rgba(255,255,255,0.9)" });
    y = bottom(box);
  } else {
    const ab = pill(x, c.contact || c.cta, { left: colL, top: y, size: 28 * k, fill: T_.btn, color: T_.btnInk, icon: "mail", name: "Apply button" });
    const gb = await ab.place();
    if (gb.getScaledWidth() > colW - 140) gb.scaleToWidth(colW - 140);
    const total = gb.getScaledWidth() + 24 + 110;
    const sx = center ? (W - total) / 2 : colL;
    gb.set({ left: sx });
    await qr(x, { left: sx + gb.getScaledWidth() + 24, top: y + gb.getScaledHeight() / 2 - 55, size: 110 });
    y = Math.max(bottom(gb), y + 110);
  }
  return y + (H - limit);
}

const LAYOUTS = { glass, studio, stripe, bold, spotlight, custom };

/** Build a design on the canvas: tries smaller text until everything fits. */
export async function buildDesign(F: F, canvas: Fab.StaticCanvas | Fab.Canvas, design: DesignId, size: SizeId, c: PosterContent, b: Brand, v: Variant) {
  const { w: W, h: H } = SIZES[size];
  await loadFonts();
  let objs: Obj[] = [];
  // Generated designs start larger and shrink until they fit, so they fill the poster instead of leaving empty space.
  for (let k = design === "custom" ? (H > 1500 ? 1.45 : 1.3) : 1; k >= 0.5; k -= 0.05) {
    const x: Ctx = { F, W, H, c, b, v, objs: [] };
    const end = size === "linkedin" ? await wide(x, design === "custom" ? (v.gen?.theme === "light" ? "studio" : "glass") : design, k) : await LAYOUTS[design](x, k);
    objs = x.objs;
    if (end <= H - 30) break;
  }
  canvas.clear();
  canvas.backgroundColor = ""; // the design's own Background layer fills the whole poster
  for (const o of objs) canvas.add(o);
  canvas.renderAll();
}

/** Small preview of a design (for the Designs panel). */
export async function previewDesign(F: F, design: DesignId, size: SizeId, c: PosterContent, b: Brand, v: Variant, width = 220) {
  const { w, h } = SIZES[size];
  const el = document.createElement("canvas");
  const sc = new F.StaticCanvas(el, { width: w, height: h, enableRetinaScaling: false });
  await buildDesign(F, sc, design, size, c, b, v);
  const url = sc.toDataURL({ format: "jpeg", quality: 0.8, multiplier: width / w });
  sc.dispose();
  return url;
}

export { iconSvg, starSvg, bubbleSvg, chairSvg, meshChairSvg, megaphoneSvg, svgUrl };
