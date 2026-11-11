import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { baseUrl } from "@/lib/messages";
import { brandOf, designFor, isDark, mix, onColor, sanitize, TEMPLATES, variations } from "@/lib/poster";
import type { Company, PosterDesign, Role } from "@/lib/types";
import { ArrowDot, Chair, Globe, Mail, Megaphone, Swoosh } from "./art";

export const runtime = "nodejs";

/**
 * Job poster image in one of four designs.
 *   ?size=portrait|square|linkedin|story   1080×1350 · 1080×1080 · 1200×627 · 1080×1920
 *   ?download=1                            save as a file
 * Owner only (for the studio):
 *   ?t=studio|stripe|bold|spotlight        show that design's default variation
 *   ?d=<json>                              preview unsaved edits
 */

const SIZES = { portrait: [1080, 1350], square: [1080, 1080], linkedin: [1200, 627], story: [1080, 1920] } as const;
type Size = keyof typeof SIZES;

type Font = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800 | 900 };
let assets: { fonts: Font[]; mark: string; markWhite: string } | null = null;
function load() {
  if (!assets) {
    const f = (n: string) => fs.readFileSync(path.join(process.cwd(), "assets", "fonts", n));
    const b = path.join(process.cwd(), "public", "brand");
    assets = {
      fonts: [
        { name: "Montserrat", data: f("montserrat-latin-600-normal.woff"), weight: 600 },
        { name: "Montserrat", data: f("montserrat-latin-700-normal.woff"), weight: 700 },
        { name: "Montserrat", data: f("montserrat-latin-800-normal.woff"), weight: 800 },
        { name: "Montserrat", data: f("montserrat-latin-900-normal.woff"), weight: 900 },
        { name: "Figtree", data: f("figtree-latin-500-normal.woff"), weight: 500 },
        { name: "Figtree", data: f("figtree-latin-700-normal.woff"), weight: 700 },
        { name: "Script", data: f("great-vibes-latin-400-normal.woff"), weight: 400 },
      ],
      mark: `data:image/png;base64,${fs.readFileSync(path.join(b, "jobbridge-mark.png")).toString("base64")}`,
      markWhite: `data:image/png;base64,${fs.readFileSync(path.join(b, "jobbridge-mark-white.png")).toString("base64")}`,
    };
  }
  return assets;
}

interface Ctx {
  d: PosterDesign;
  W: number;
  H: number;
  m: number; // text size multiplier for the format
  wide: boolean;
  qr: string;
  short: string;
  mark: string;
  markWhite: string;
}

// ---------- Auto-fit helpers: edited text can be long, so each design shrinks its text until it fits ----------

/** Rough number of lines a text needs at a font size and width (average glyph width as a share of the size). */
const lines = (text: string, fs: number, width: number, em = 0.56) => (text ? Math.max(1, Math.ceil((text.length * fs * em) / width)) : 0);
/** Largest scale (at most 1) at which the content fits the space. */
function fit(space: number, need: (k: number) => number) {
  let k = 1;
  while (k > 0.45 && need(k) > space) k -= 0.03;
  return k;
}
/** Size for the big word: as large as possible, on one line if it can be, otherwise wrapped. */
function big(text: string, max: number, width: number, em: number, maxLines = 3) {
  if (!text) return { size: 0, n: 0 };
  const one = width / (text.length * em);
  if (one >= max * 0.62 || !text.includes(" ")) return { size: Math.min(max, one), n: 1 };
  for (let n = 2; n <= maxLines; n++) {
    const s = Math.min(max, ((width * n) / (text.length * em)) * 0.86);
    if (s >= max * 0.5 || n === maxLines) return { size: s, n: Math.max(1, Math.min(n, lines(text, s, width, em))) };
  }
  return { size: one, n: 1 };
}

// ---------- Shared pieces ----------

function Logo({ c, dark, s = 1, center = false }: { c: Ctx; dark: boolean; s?: number; center?: boolean }) {
  const z = c.m * s;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 * z, alignSelf: center ? "center" : "flex-start" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark ? c.markWhite : c.mark} width={70 * z} height={70 * z} alt="" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 800, fontSize: 34 * z, letterSpacing: -0.5 }}>
          <span style={{ color: dark ? "#FFFFFF" : "#063B67" }}>JOB</span>
          <span style={{ color: dark ? "#5DB6F7" : "#047CD3" }}>BRIDGE</span>
        </div>
        <div style={{ display: "flex", fontSize: 11.5 * z, letterSpacing: 2.2 * z, fontWeight: 700, color: dark ? "rgba(255,255,255,0.65)" : "#8B898A" }}>CONNECTING TALENT TO OPPORTUNITY</div>
      </div>
    </div>
  );
}

function Qr({ c, s, border }: { c: Ctx; s: number; border?: string }) {
  return (
    <div style={{ display: "flex", background: "#FFFFFF", padding: 8 * c.m, borderRadius: 14 * c.m, border: border ? `${3 * c.m}px solid ${border}` : "none" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.qr} width={s} height={s} alt="" />
    </div>
  );
}

/** The handwriting font has very narrow spaces, so widen them. */
const spaced = (t: string) => t.replace(/ /g, " ");

const linkText = (c: Ctx) => c.short.replace(/^https?:\/\//, "");

// ---------- 1. Studio chair: light background, big "Hiring", outlined position pill, office chair ----------

function Studio(c: Ctx) {
  if (c.wide) return Wide(c, "studio");
  const { d, W, H, m } = c;
  const pad = 70 * m;
  const tw = 600;
  const hw = W - 2 * pad - 60; // the big word may run over the chair, as in print posters
  const chairW = (H > 1500 ? 0.3 : H > 1200 ? 0.37 : 0.37) * H;
  const body = d.text;
  const need = (k: number) => {
    const h = big(d.headline, 250 * m * k, hw, 0.64, 2);
    return (
      95 * m + 50 * m + (d.kicker ? 76 * m * k : 0) + h.size * h.n * 0.98 + (d.tagline ? 14 * m + lines(d.tagline, 44 * m * k, tw - 130, 0.56) * 44 * m * k * 1.2 : 0) +
      40 * m + (d.label ? 50 * m * k : 0) + lines(d.title, 38 * m * k, tw - 90, 0.6) * 38 * m * k * 1.22 + 34 * m +
      (d.points.length ? 14 * m + d.points.length * (27 * m * k * 1.35 + 6 * m) : 0) + 40 * m + 150 * m + (d.footer ? 84 * m : 0)
    );
  };
  const k = fit(H - 2 * pad, need);
  const h = big(d.headline, 250 * m * k, hw, 0.64, 2);
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: `linear-gradient(180deg, ${mix(d.bg, "#FFFFFF", 0.5)} 0%, ${d.bg} 100%)`, color: body, fontFamily: "Figtree", position: "relative", overflow: "hidden", padding: pad }}>
      <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: H * 0.3, display: "flex", background: `linear-gradient(180deg, ${d.bg}00 0%, ${mix(d.bg, "#000000", 0.06)} 100%)` }} />
      <div style={{ position: "absolute", right: -40, top: 40 * m, display: "flex", opacity: 0.45 }}>
        <Swoosh w={330 * m} h={430 * m} color={mix(d.accent, d.bg, 0.25)} />
      </div>
      <div style={{ position: "absolute", right: -chairW * 0.06, bottom: H * 0.03, display: "flex" }}>
        <Chair w={chairW} color={d.accent} id="st" />
      </div>
      <Logo c={c} dark={isDark(d.bg)} center />
      <div style={{ display: "flex", flexDirection: "column", width: tw, marginTop: 50 * m }}>
        {d.kicker && <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 70 * m * k, color: d.accent, lineHeight: 1.05 }}>{d.kicker}</div>}
        {d.headline && <div style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: h.size, color: d.accent, lineHeight: 0.98, letterSpacing: -4 * m, width: hw }}>{d.headline}</div>}
        {d.tagline && (
          <div style={{ display: "flex", alignItems: "center", gap: 22 * m, marginTop: 14 * m }}>
            <div style={{ fontFamily: "Montserrat", fontWeight: 600, fontSize: 44 * m * k, color: body, lineHeight: 1.2, maxWidth: tw - 130 }}>{d.tagline}</div>
            <div style={{ display: "flex", width: 120 * m, height: 2, background: body, opacity: 0.6 }} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 * m }}>
          {d.label && <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 36 * m * k, color: d.accent, marginBottom: 12 * m }}>{d.label}</div>}
          <div style={{ display: "flex", position: "relative", alignSelf: "flex-start", maxWidth: tw - 40, border: `${3 * m}px solid ${body}`, borderRadius: 22 * m, padding: `${12 * m}px ${30 * m}px`, background: mix(d.bg, "#FFFFFF", 0.6) }}>
            <div style={{ position: "absolute", left: -11 * m, top: "50%", marginTop: -10 * m, width: 20 * m, height: 20 * m, borderRadius: 99, background: d.accent, display: "flex" }} />
            <div style={{ fontFamily: "Montserrat", fontWeight: 600, fontSize: 38 * m * k, color: body, lineHeight: 1.22 }}>{d.title}</div>
          </div>
          {d.points.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 * m, marginTop: 14 * m, paddingLeft: 6 * m }}>
              {d.points.map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 14 * m, fontSize: 27 * m * k, fontWeight: 500, color: body }}>
                  <div style={{ display: "flex", width: 10 * m, height: 10 * m, borderRadius: 99, background: d.accent }} />
                  {p}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 18 * m }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 * m }}>
          <Qr c={c} s={112 * m} border={d.accent} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Montserrat", fontWeight: 600, fontSize: 32 * m, color: body }}>{`${d.cta}:`}</div>
            {d.contact && <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 32 * m, color: d.accent }}>{d.contact}</div>}
            <div style={{ fontSize: 22 * m, color: body, opacity: 0.75, marginTop: 4 * m }}>{`Scan or visit ${linkText(c)}`}</div>
          </div>
        </div>
        {d.footer && (
          <div style={{ display: "flex", alignSelf: "flex-start", background: d.accent, color: onColor(d.accent), borderRadius: 18 * m, padding: `${14 * m}px ${34 * m}px`, fontFamily: "Montserrat", fontWeight: 600, fontSize: 30 * m }}>{d.footer}</div>
        )}
      </div>
    </div>
  );
}

// ---------- 2. Megaphone stripe: off-white with a bold brand stripe and a megaphone ----------

function Stripe(c: Ctx) {
  if (c.wide) return Wide(c, "stripe");
  const { d, W, H, m } = c;
  const band = d.accent;
  const ink = d.text;
  const left = W * 0.5;
  const tw = W - left - 60;
  const top = 270 * m;
  const bottomLimit = H * 0.8;
  const need = (k: number) => {
    const h = big(d.headline, 170 * m * k, tw, 0.66, 2);
    return (
      (d.kicker ? 110 * m * k : 0) + h.size * h.n * 0.98 + (d.tagline ? lines(d.tagline, 46 * m * k, tw, 0.6) * 46 * m * k * 1.15 : 0) +
      (d.label ? 30 * m + 62 * m * k : 0) + 22 * m + lines(d.title.toUpperCase(), 34 * m * k, tw, 0.72) * 34 * m * k * 1.2 +
      (d.points.length ? 14 * m + d.points.reduce((s, p) => s + lines(p, 27 * m * k, tw - 30, 0.55) * 27 * m * k * 1.35 + 8 * m, 0) : 0) +
      36 * m + 76 * m + (d.contact ? 46 * m : 0) + 20 * m + 104 * m
    );
  };
  const k = fit(bottomLimit - top, need);
  const h = big(d.headline, 170 * m * k, tw, 0.66, 2);
  return (
    <div style={{ width: W, height: H, display: "flex", background: d.bg, fontFamily: "Figtree", position: "relative", overflow: "hidden", color: ink }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
        <polygon points={`${W * 0.06},0 ${W * 0.4},0 ${W * 0.44},${H * 0.79} ${W},${H} 0,${H} 0,0`} fill={band} />
        <polygon points={`${W * 0.4},0 ${W * 0.41},0 ${W * 0.45},${H * 0.79} ${W * 0.44},${H * 0.79}`} fill={mix(band, "#000000", 0.25)} />
      </svg>
      <div style={{ position: "absolute", left: -30 * m, top: H * (H > 1500 ? 0.36 : 0.3), display: "flex" }}>
        <Megaphone w={W * 0.56} rim={mix(band, "#FFFFFF", 0.45)} id="sp" />
      </div>
      {/* Round logo badge */}
      <div style={{ position: "absolute", right: 60 * m, top: 56 * m, width: 176 * m, height: 176 * m, borderRadius: 999, background: band, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={isDark(band) ? c.markWhite : c.mark} width={92 * m} height={92 * m} alt="" />
        <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 800, fontSize: 19 * m, color: onColor(band), letterSpacing: 1 }}>JOBBRIDGE</div>
      </div>
      <div style={{ position: "absolute", left, top, width: tw, display: "flex", flexDirection: "column" }}>
        {d.kicker && <div style={{ fontFamily: "Script", fontSize: 120 * m * k, lineHeight: 0.95, color: ink, marginLeft: -8 * m }}>{spaced(d.kicker)}</div>}
        {d.headline && <div style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: h.size, lineHeight: 0.98, color: band, letterSpacing: -3 * m }}>{d.headline}</div>}
        {d.tagline && <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 46 * m * k, lineHeight: 1.15, color: ink }}>{d.tagline}</div>}
        {d.label && <div style={{ display: "flex", alignSelf: "flex-start", marginTop: 30 * m, background: band, color: onColor(band), fontFamily: "Montserrat", fontWeight: 700, fontSize: 34 * m * k, padding: `${12 * m}px ${28 * m}px` }}>{d.label}</div>}
        <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 34 * m * k, marginTop: 22 * m, lineHeight: 1.2, color: ink, textTransform: "uppercase" }}>{d.title}</div>
        {d.points.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 * m, marginTop: 14 * m }}>
            {d.points.map((p) => (
              <div key={p} style={{ display: "flex", gap: 14 * m, fontSize: 27 * m * k, lineHeight: 1.35, color: ink }}>
                <span>•</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", gap: 14 * m, marginTop: 36 * m, background: band, color: onColor(band), borderRadius: 99, padding: `${14 * m}px ${34 * m}px`, fontFamily: "Montserrat", fontWeight: 700, fontSize: 36 * m }}>
          <Mail s={36 * m} color={onColor(band)} />
          {d.cta}
        </div>
        {d.contact && <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 28 * m, marginTop: 14 * m, color: ink }}>{d.contact}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 16 * m, marginTop: 20 * m }}>
          <Qr c={c} s={84 * m} border={band} />
          <div style={{ display: "flex", flexDirection: "column", fontSize: 21 * m, color: ink }}>
            <span style={{ fontWeight: 700 }}>Scan to apply</span>
            <span style={{ opacity: 0.75 }}>{linkText(c)}</span>
          </div>
        </div>
      </div>
      {d.footer && (
        <div style={{ position: "absolute", left: 64 * m, bottom: 56 * m, display: "flex", alignItems: "center", gap: 12 * m, color: onColor(band), fontWeight: 700, fontSize: 28 * m }}>
          <Globe s={30 * m} color={onColor(band)} />
          {d.footer}
        </div>
      )}
    </div>
  );
}

// ---------- 3. Bold brand: full brand colour, script + big caps, chair with a question mark ----------

function Bold(c: Ctx) {
  if (c.wide) return Wide(c, "bold");
  const { d, W, H, m } = c;
  const ink = d.text;
  const pad = 66 * m;
  const tw = 590;
  const footH = 150 * m;
  const chairW = (H > 1500 ? 0.27 : 0.31) * H;
  const head = d.headline.toUpperCase();
  const need = (k: number) => {
    const h = big(head, 150 * m * k, tw, 0.74, 3);
    return (
      50 * m + 30 * m + (d.kicker ? 120 * m * k : 0) + h.size * h.n * 0.95 + (d.tagline ? 16 * m + lines(d.tagline, 42 * m * k, tw, 0.6) * 42 * m * k * 1.15 : 0) +
      (d.intro ? 8 * m + lines(d.intro, 25 * m * k, tw - 60, 0.52) * 25 * m * k * 1.3 : 0) + 34 * m + (d.label ? 30 * m * k : 0) + lines(d.title, 54 * m * k, tw - 70, 0.62) * 54 * m * k * 1.1 +
      (d.points.length ? 26 * m + 40 * m * k + d.points.reduce((s, p) => s + lines(p, 26 * m * k, tw - 60, 0.55) * 26 * m * k * 1.35 + 8 * m, 0) : 0) +
      34 * m + 74 * m + (d.contact ? 44 * m : 0)
    );
  };
  const k = fit(H - footH - 2 * pad, need);
  const h = big(head, 150 * m * k, tw, 0.74, 3);
  const chairColor = mix(d.bg, "#0B0F14", 0.72);
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: `linear-gradient(160deg, ${mix(d.bg, "#FFFFFF", 0.12)} 0%, ${d.bg} 45%, ${mix(d.bg, "#000000", 0.3)} 100%)`, color: ink, fontFamily: "Figtree", position: "relative", overflow: "hidden" }}>
      {/* Giant faded word on the right */}
      <div style={{ position: "absolute", left: W - 310 * m, top: H * 0.06, display: "flex", width: H * 0.9, height: 420 * m, transform: "rotate(90deg)", transformOrigin: "0 0", fontFamily: "Montserrat", fontWeight: 900, fontSize: 400 * m, lineHeight: 1, color: d.accent, opacity: 0.13, letterSpacing: 6 }}>
        JOIN
      </div>
      <div style={{ position: "absolute", right: 30 * m, bottom: footH + 10 * m, display: "flex" }}>
        <Chair w={chairW} color={chairColor} id="bd" />
      </div>
      <div style={{ position: "absolute", right: 30 * m + chairW * 0.27, bottom: footH + chairW * 0.66, display: "flex", fontFamily: "Montserrat", fontWeight: 900, fontSize: chairW * 0.78, lineHeight: 1, color: d.accent }}>?</div>
      <div style={{ display: "flex", flexDirection: "column", padding: `${pad}px ${pad}px 0`, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 * m, fontWeight: 500, color: ink }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 * m }}>{d.footer && <Globe s={28 * m} color={ink} />}{d.footer}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 * m }}>{d.contact && <Mail s={28 * m} color={ink} />}{d.contact}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: tw, marginTop: 30 * m }}>
          {d.kicker && <div style={{ fontFamily: "Script", fontSize: 128 * m * k, lineHeight: 0.92, color: ink }}>{spaced(d.kicker)}</div>}
          {head && <div style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: h.size, lineHeight: 0.95, color: ink, letterSpacing: -1 * m }}>{head}</div>}
          {d.tagline && <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 42 * m * k, lineHeight: 1.15, color: d.accent, marginTop: 16 * m }}>{d.tagline}</div>}
          {d.intro && <div style={{ fontSize: 25 * m * k, lineHeight: 1.3, color: ink, opacity: 0.85, marginTop: 8 * m, maxWidth: tw - 60 }}>{d.intro}</div>}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 34 * m }}>
            {d.label && <div style={{ fontSize: 24 * m * k, fontWeight: 700, color: d.accent, letterSpacing: 2 * m, textTransform: "uppercase" }}>{d.label}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 16 * m }}>
              <ArrowDot s={44 * m * k} color={d.accent} arrow={d.bg} />
              <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 54 * m * k, lineHeight: 1.1, color: ink, maxWidth: tw - 70 }}>{d.title}</div>
            </div>
          </div>
          {d.points.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 26 * m }}>
              <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 32 * m * k, color: ink, marginBottom: 8 * m }}>Job details:</div>
              {d.points.map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 12 * m, fontSize: 26 * m * k, lineHeight: 1.35, color: ink, marginBottom: 8 * m }}>
                  <ArrowDot s={22 * m * k} color={mix(d.bg, "#FFFFFF", 0.25)} arrow={ink} />
                  {p}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", gap: 14 * m, marginTop: 34 * m, background: d.accent, color: onColor(d.accent), borderRadius: 12 * m, padding: `${12 * m}px ${26 * m}px`, fontFamily: "Montserrat", fontWeight: 800, fontSize: 36 * m }}>
            {d.cta}
            <ArrowDot s={34 * m} color={onColor(d.accent)} arrow={d.accent} />
          </div>
          {d.contact && <div style={{ fontSize: 28 * m, marginTop: 14 * m, color: ink }}>{d.contact}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: footH, padding: `0 ${pad}px`, background: "rgba(0,0,0,0.18)" }}>
        <Logo c={c} dark s={0.95} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 * m }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 22 * m, color: ink }}>
            <span style={{ fontWeight: 700 }}>Scan to apply</span>
            <span style={{ opacity: 0.75 }}>{linkText(c)}</span>
          </div>
          <Qr c={c} s={96 * m} />
        </div>
      </div>
    </div>
  );
}

// ---------- 4. Announcement: deep brand colour, centred text, megaphone with sound waves ----------

function Spotlight(c: Ctx) {
  if (c.wide) return Wide(c, "spotlight");
  const { d, W, H, m } = c;
  const ink = d.text;
  const pad = 64 * m;
  const tw = 900;
  const bottomH = (H > 1500 ? 420 : 300) * m;
  const head = d.headline.toUpperCase();
  const chipRows = (k: number) => Math.max(1, Math.ceil(d.points.reduce((s, p) => s + p.length * 26 * m * k * 0.55 + 70 * m, 0) / tw));
  const need = (k: number) => {
    const h = big(head, 170 * m * k, tw, 0.74, 2);
    return (
      90 * m + 40 * m + (d.kicker ? 116 * m * k : 0) + h.size * h.n * 0.95 + (d.tagline ? 12 * m + lines(d.tagline, 40 * m * k, tw, 0.58) * 40 * m * k * 1.2 : 0) +
      40 * m + (d.label ? 60 * m * k + 16 * m : 0) + lines(d.title, 62 * m * k, tw, 0.62) * 62 * m * k * 1.1 + (d.intro ? 12 * m + lines(d.intro, 26 * m * k, 820, 0.52) * 26 * m * k * 1.35 : 0) +
      (d.points.length ? 28 * m + chipRows(k) * (26 * m * k * 1.3 + 38 * m) : 0)
    );
  };
  const k = fit(H - pad - bottomH, need);
  const h = big(head, 170 * m * k, tw, 0.74, 2);
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", alignItems: "center", background: `linear-gradient(180deg, ${mix(d.bg, "#FFFFFF", 0.08)} 0%, ${d.bg} 55%, ${mix(d.bg, "#000000", 0.35)} 100%)`, color: ink, fontFamily: "Figtree", position: "relative", overflow: "hidden", padding: `${pad}px ${pad}px 0`, textAlign: "center" }}>
      <div style={{ position: "absolute", left: -W * 0.25, bottom: -W * 0.45, width: W * 1.1, height: W * 1.1, borderRadius: 9999, border: `${50 * m}px solid ${d.accent}`, opacity: 0.08, display: "flex" }} />
      <div style={{ position: "absolute", left: -W * 0.05, bottom: -W * 0.25, width: W * 0.7, height: W * 0.7, borderRadius: 9999, border: `${30 * m}px solid ${d.accent}`, opacity: 0.1, display: "flex" }} />
      <Logo c={c} dark={isDark(d.bg)} center />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 * m, maxWidth: tw }}>
        {d.kicker && <div style={{ fontFamily: "Script", fontSize: 124 * m * k, lineHeight: 0.92, color: d.accent }}>{spaced(d.kicker)}</div>}
        {head && <div style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: h.size, lineHeight: 0.95, color: ink, letterSpacing: -1 * m }}>{head}</div>}
        {d.tagline && <div style={{ fontFamily: "Montserrat", fontWeight: 600, fontSize: 40 * m * k, lineHeight: 1.2, marginTop: 12 * m, color: ink, opacity: 0.92 }}>{d.tagline}</div>}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 * m }}>
          {d.label && <div style={{ display: "flex", border: `${3 * m}px solid ${d.accent}`, color: d.accent, borderRadius: 99, padding: `${8 * m}px ${28 * m}px`, fontFamily: "Montserrat", fontWeight: 700, fontSize: 28 * m * k, letterSpacing: 3 * m, textTransform: "uppercase", marginBottom: 16 * m }}>{d.label}</div>}
          <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 62 * m * k, lineHeight: 1.1, color: ink }}>{d.title}</div>
          {d.intro && <div style={{ fontSize: 26 * m * k, lineHeight: 1.35, marginTop: 12 * m, color: ink, opacity: 0.8, maxWidth: 820 }}>{d.intro}</div>}
        </div>
        {d.points.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 * m, marginTop: 28 * m }}>
            {d.points.map((p) => (
              <div key={p} style={{ display: "flex", padding: `${10 * m}px ${24 * m}px`, borderRadius: 99, background: "rgba(255,255,255,0.1)", border: `2px solid ${d.accent}`, fontSize: 26 * m * k, fontWeight: 700, color: ink }}>{p}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: -20 * m, bottom: 30 * m, display: "flex" }}>
        <Megaphone w={(H > 1500 ? 560 : H > 1200 ? 470 : 400) * m} rim={d.accent} waves id="sl" />
      </div>
      <div style={{ position: "absolute", right: pad, bottom: 56 * m, display: "flex", alignItems: "center", gap: 20 * m }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 * m }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 * m, background: d.accent, color: onColor(d.accent), borderRadius: 99, padding: `${14 * m}px ${32 * m}px`, fontFamily: "Montserrat", fontWeight: 800, fontSize: 34 * m }}>
            {d.cta}
            <ArrowDot s={32 * m} color={onColor(d.accent)} arrow={d.accent} />
          </div>
          {d.contact && <div style={{ fontSize: 26 * m, fontWeight: 700, color: ink }}>{d.contact}</div>}
          <div style={{ fontSize: 21 * m, color: ink, opacity: 0.75 }}>{`${d.footer ? `${d.footer} · ` : ""}${linkText(c)}`}</div>
        </div>
        <Qr c={c} s={112 * m} />
      </div>
    </div>
  );
}

// ---------- LinkedIn (wide) version of every design: text on the left, artwork on the right ----------

function Wide(c: Ctx, kind: "studio" | "stripe" | "bold" | "spotlight") {
  const { d, W, H } = c;
  const m = 0.62;
  const dark = isDark(d.bg);
  const light = kind === "studio" || kind === "stripe";
  const ink = d.text;
  const big1 = kind === "studio" || kind === "stripe" ? d.accent : ink;
  const script = kind === "studio" ? d.accent : kind === "spotlight" ? d.accent : ink;
  const head = kind === "bold" || kind === "spotlight" ? d.headline.toUpperCase() : d.headline;
  const tw = 640;
  const need = (k: number) => {
    const h = big(head, 140 * k, tw, kind === "bold" || kind === "spotlight" ? 0.74 : 0.64, 1);
    return 60 + (d.kicker ? 80 * k : 0) + h.size * 0.98 + (d.tagline ? 34 * k * 1.2 : 0) + 18 + 46 * k + (d.points.length ? 34 * k : 0) + 24 + 70;
  };
  const k = fit(H - 80, need);
  const h = big(head, 140 * k, tw, kind === "bold" || kind === "spotlight" ? 0.74 : 0.64, 1);
  const bg =
    kind === "studio" ? `linear-gradient(180deg, ${mix(d.bg, "#FFFFFF", 0.5)} 0%, ${d.bg} 100%)` : kind === "stripe" ? d.bg : `linear-gradient(140deg, ${mix(d.bg, "#FFFFFF", 0.1)} 0%, ${d.bg} 50%, ${mix(d.bg, "#000000", 0.3)} 100%)`;
  return (
    <div style={{ width: W, height: H, display: "flex", background: bg, color: ink, fontFamily: "Figtree", position: "relative", overflow: "hidden" }}>
      {kind === "stripe" && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
          <polygon points={`${W * 0.66},0 ${W},0 ${W},${H} ${W * 0.74},${H}`} fill={d.accent} />
        </svg>
      )}
      {kind === "studio" && (
        <div style={{ position: "absolute", right: 30, top: 10, display: "flex", opacity: 0.4 }}>
          <Swoosh w={250} h={320} color={d.accent} />
        </div>
      )}
      {kind === "bold" && <div style={{ position: "absolute", right: -20, top: -60, display: "flex", fontFamily: "Montserrat", fontWeight: 900, fontSize: 330, color: d.accent, opacity: 0.12 }}>JOIN</div>}
      <div style={{ position: "absolute", right: kind === "stripe" ? 30 : 50, bottom: kind === "bold" ? 20 : 26, display: "flex" }}>
        {kind === "studio" && <Chair w={330} color={d.accent} id="ws" />}
        {kind === "bold" && <Chair w={300} color={mix(d.bg, "#0B0F14", 0.72)} id="wb" />}
        {(kind === "stripe" || kind === "spotlight") && <Megaphone w={kind === "stripe" ? 430 : 420} rim={kind === "stripe" ? mix(d.accent, "#FFFFFF", 0.45) : d.accent} waves={kind === "spotlight"} id="wm" />}
      </div>
      {kind === "bold" && <div style={{ position: "absolute", right: 50 + 300 * 0.27, bottom: 20 + 300 * 0.66, display: "flex", fontFamily: "Montserrat", fontWeight: 900, fontSize: 230, lineHeight: 1, color: d.accent }}>?</div>}
      <div style={{ position: "absolute", right: 36, top: 30, display: "flex" }}>
        <Logo c={{ ...c, m }} dark={kind === "stripe" ? isDark(d.accent) : dark} s={0.95} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "40px 52px", width: tw + 104 }}>
        {d.kicker && <div style={{ fontFamily: kind === "studio" ? "Montserrat" : "Script", fontWeight: 700, fontSize: (kind === "studio" ? 48 : 80) * k, lineHeight: 1, color: script }}>{kind === "studio" ? d.kicker : spaced(d.kicker)}</div>}
        {head && <div style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: h.size, lineHeight: 0.98, color: big1, letterSpacing: -2 }}>{head}</div>}
        {d.tagline && <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 32 * k, color: kind === "bold" ? d.accent : ink, marginTop: 4 }}>{d.tagline}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
          {d.label && <div style={{ display: "flex", background: light ? d.accent : "transparent", border: light ? "none" : `2px solid ${d.accent}`, color: light ? onColor(d.accent) : d.accent, fontFamily: "Montserrat", fontWeight: 700, fontSize: 20 * k, padding: "6px 14px", borderRadius: kind === "stripe" ? 0 : 99, whiteSpace: "nowrap", flexShrink: 0 }}>{d.label}</div>}
          <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 36 * k, color: ink }}>{d.title}</div>
        </div>
        {d.points.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", columnGap: 22, rowGap: 4, marginTop: 10, fontSize: 21 * k, color: ink }}>
            {d.points.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", width: 8, height: 8, borderRadius: 9, background: light ? d.accent : d.accent }} />
                {p}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: d.accent, color: onColor(d.accent), borderRadius: 99, padding: "10px 24px", fontFamily: "Montserrat", fontWeight: 800, fontSize: 24 }}>
            {d.cta}
            <ArrowDot s={24} color={onColor(d.accent)} arrow={d.accent} />
          </div>
          <Qr c={{ ...c, m }} s={64} border={light ? d.accent : undefined} />
          <div style={{ display: "flex", flexDirection: "column", fontSize: 17, color: ink }}>
            {d.contact && <span style={{ fontWeight: 700 }}>{d.contact}</span>}
            <span style={{ opacity: 0.75 }}>{linkText(c)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const RENDER = { studio: Studio, stripe: Stripe, bold: Bold, spotlight: Spotlight };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const size = (url.searchParams.get("size") ?? "portrait") as Size;
  const [W, H] = SIZES[size] ?? SIZES.portrait;

  const role = await db.one<Role>("select * from roles where id = $1", [Number(id)]);
  if (!role) return new Response("Not found", { status: 404 });
  const owner = await currentUser();
  if (role.status === "draft" && !owner) return new Response("Not found", { status: 404 });

  // A poster edited in the poster editor wins: serve the exact image that was saved.
  if (!url.searchParams.get("t") && !url.searchParams.get("d")) {
    const edited = await db.one<{ png: string; design: string }>("select png, design from poster_images where role_id = $1 and size = $2", [role.id, size]);
    if (edited) {
      const headers = new Headers({ "content-type": "image/png", "cache-control": "no-store" });
      if (url.searchParams.get("download")) headers.set("content-disposition", `attachment; filename="jobbridge-${role.slug}-${size}.png"`);
      return new Response(Buffer.from(edited.png, "base64"), { status: 200, headers });
    }
  }

  // Saved design for everyone; the owner can preview a design or unsaved edits.
  const brand = brandOf((await db.one<Company>("select * from companies where id = $1", [role.company_id]))!);
  let design = designFor(role, brand);
  const t = url.searchParams.get("t");
  const raw = url.searchParams.get("d");
  if (owner && t && TEMPLATES.some((x) => x.id === t)) design = variations(role, brand).find((v) => v.template === t)!;
  if (owner && raw) {
    try {
      design = sanitize(JSON.parse(raw), design);
    } catch {
      /* keep the saved design */
    }
  }

  const { fonts, mark, markWhite } = load();
  const short = `${baseUrl()}/apply/${role.slug}`;
  const qr = await QRCode.toDataURL(`${short}?src=poster`, { margin: 1, width: 360, color: { dark: "#0C1B2E", light: "#FFFFFF" } });
  const m = size === "square" ? 0.86 : size === "story" ? 1.12 : 1;
  const ctx: Ctx = { d: design, W, H, m, wide: size === "linkedin", qr, short, mark, markWhite };

  const res = new ImageResponse(RENDER[design.template](ctx), { width: W, height: H, fonts: fonts.map((f) => ({ ...f, style: "normal" as const })) });
  const headers = new Headers(res.headers);
  headers.set("cache-control", "no-store");
  if (url.searchParams.get("download")) headers.set("content-disposition", `attachment; filename="jobbridge-${role.slug}-${design.template}-${size}.png"`);
  return new Response(res.body, { status: 200, headers });
}
