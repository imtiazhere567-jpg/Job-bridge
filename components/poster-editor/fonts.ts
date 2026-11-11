/** Every Google Font, loaded only when it is shown or used. */
import { FONTS } from "./build";

/** [family, category (Sa/Se/Di/Ha/Mo), weights]: most popular first. */
export type GFont = [string, string, number[]];
export const CATEGORY: Record<string, string> = { Sa: "Sans serif", Se: "Serif", Di: "Display", Ha: "Handwriting", Mo: "Monospace" };

/** The poster's own fonts (bundled, always available). */
export const OWN_FONTS: { id: string; label: string }[] = [
  { id: FONTS.head, label: "Montserrat (brand)" },
  { id: FONTS.body, label: "Figtree (brand)" },
  { id: FONTS.script, label: "Great Vibes (brand)" },
];
const OWN = new Set(OWN_FONTS.map((f) => f.id));
export const fontLabel = (id: string) => OWN_FONTS.find((f) => f.id === id)?.label ?? id;

let list: Promise<GFont[]> | null = null;
export const googleFonts = (): Promise<GFont[]> => (list ??= fetch("/google-fonts.json").then((r) => r.json() as Promise<GFont[]>).catch(() => [] as GFont[]));

const cssUrl = (family: string, weights: number[], text?: string) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}${weights.length > 1 || weights[0] !== 400 ? `:wght@${weights.join(";")}` : ""}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ""}`;

const loaded = new Map<string, Promise<void>>();
/** Load a Google Font (all its upright weights) so it can be drawn on the canvas. */
export function loadFont(family: string): Promise<void> {
  if (!family || OWN.has(family)) return Promise.resolve();
  if (!loaded.has(family)) {
    loaded.set(
      family,
      (async () => {
        const all = await googleFonts();
        const ws = (all.find((f) => f[0] === family)?.[2] ?? [400, 700]).filter((w) => w >= 100 && w <= 900);
        const weights = ws.length ? ws : [400];
        await new Promise<void>((res) => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = cssUrl(family, weights);
          link.onload = () => res();
          link.onerror = () => res();
          document.head.appendChild(link);
        });
        await Promise.all(weights.map((w) => document.fonts.load(`${w} 40px "${family}"`))).catch(() => undefined);
      })(),
    );
  }
  return loaded.get(family)!;
}

/** Load every non-bundled font used in a saved poster (Fabric JSON). */
export async function loadDocFonts(doc: unknown) {
  const found = new Set<string>();
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    const r = o as Record<string, unknown>;
    if (typeof r.fontFamily === "string") found.add(r.fontFamily);
    Object.values(r).forEach(walk);
  };
  walk(doc);
  await Promise.all([...found].map(loadFont));
}

const previews = new Map<string, Promise<string>>();
/**
 * A tiny version of a font with only the letters of its name, under a private
 * name, so the font list can show each font in its own style cheaply.
 */
export function previewFamily(family: string, weights: number[] = [400]): Promise<string> {
  const w = weights.includes(400) ? 400 : weights.find((x) => x >= 100 && x <= 900) ?? 400;
  if (!previews.has(family)) {
    const alias = `pv-${family.replace(/[^a-z0-9]/gi, "")}`;
    previews.set(
      family,
      fetch(cssUrl(family, [w], family))
        .then((r) => r.text())
        .then((css) => {
          const style = document.createElement("style");
          style.textContent = css.replace(/font-family:\s*'[^']*'/g, `font-family: '${alias}'`);
          document.head.appendChild(style);
          return alias;
        })
        .catch(() => ""),
    );
  }
  return previews.get(family)!;
}
