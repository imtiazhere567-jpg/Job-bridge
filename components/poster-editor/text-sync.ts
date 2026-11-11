/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Text changes made on one poster are remembered as "from → to" pairs and
 * applied to every size, every ready-made design and every variation.
 * Matching is by whole line (or a "•"-separated part of a line), ignoring the
 * bullet in front, so "• Video editing" and "› Video editing" both follow.
 */
import type { PosterContent } from "./build";

export type TextEdit = [string, string];

const PREFIX = /^(\s*(?:[•›✓*\-–]|\d+[.)])\s+)/;
const SEP = /(\s+[•·|]\s+)/;

const split = (s: string): [string, string] => {
  const m = s.match(PREFIX);
  return m ? [m[1], s.slice(m[1].length)] : ["", s];
};
const core = (s: string) => split(s)[1].trim();
const parts = (line: string) => line.split(SEP).filter((_, i) => i % 2 === 0);

/**
 * The words that actually changed, e.g. "$26k – $30k /yr + commission" → "$28k – $32k /yr + commission"
 * gives ["$26k – $30k", "$28k – $32k"]. Null when the whole text changed.
 */
export function coreDiff(from: string, to: string): TextEdit | null {
  const a = from.split(/(\s+)/);
  const b = to.split(/(\s+)/);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const f = a.slice(p, a.length - s).join("").trim();
  const t = b.slice(p, b.length - s).join("").trim();
  if (!f || !t || f === from.trim()) return null;
  return [f, t];
}

/** Record that `from` became `to`, merged with earlier edits. */
export function addEdit(edits: TextEdit[], from: string, to: string): TextEdit[] {
  if (from === to) return edits;
  const pairs: TextEdit[] = [];
  const a = from.split("\n");
  const b = to.split("\n");
  if (a.length === b.length) {
    a.forEach((la, i) => {
      const pa = parts(core(la));
      const pb = parts(core(b[i]));
      if (pa.length === pb.length) pa.forEach((x, k) => x.trim() !== pb[k].trim() && pairs.push([x.trim(), pb[k].trim()]));
      else if (core(la) !== core(b[i])) pairs.push([core(la), core(b[i])]);
      const d = core(la) !== core(b[i]) ? coreDiff(core(la), core(b[i])) : null;
      if (d) pairs.push(d);
    });
  } else {
    pairs.push([from.trim(), to.trim()]);
    // Lines that were removed disappear everywhere.
    const kept = new Set(b.map(core));
    for (const l of a) if (core(l) && !kept.has(core(l))) pairs.push([core(l), ""]);
  }
  return mergeEdits(edits, pairs);
}

/** Add "from → to" pairs to the list, following chains (A→B then B→C becomes A→C). */
export function mergeEdits(edits: TextEdit[], pairs: TextEdit[]): TextEdit[] {
  const out = [...edits];
  for (const [f, t] of pairs) {
    if (!f) continue;
    const chained = out.findIndex((e) => e[1] === f && e[1] !== "");
    if (chained >= 0) out[chained] = [out[chained][0], t];
    else {
      const same = out.findIndex((e) => e[0] === f);
      if (same >= 0) out[same] = [f, t];
      else out.push([f, t]);
    }
  }
  return out.filter((e) => e[0] !== e[1]);
}

/** Apply the edits to one piece of text. */
export function applyText(text: string, edits: TextEdit[]): string {
  if (!edits.length || !text) return text;
  const map = new Map(edits);
  const whole = map.get(text.trim());
  if (whole !== undefined) return whole;
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const [pre, body] = split(line);
    const r = map.get(body.trim());
    if (r !== undefined) {
      if (r !== "") lines.push(pre + r);
      continue;
    }
    const bits = body.split(SEP);
    const out: string[] = [];
    for (let i = 0; i < bits.length; i += 2) {
      const v = map.get(bits[i].trim());
      if (v === "") continue;
      if (out.length) out.push(bits[i - 1] ?? " • ");
      out.push(v ?? bits[i]);
    }
    lines.push(pre + out.join(""));
  }
  return replaceWithin(lines.join("\n"), edits);
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Changed words inside longer text: "$26k – $30k /yr" also follows a "$26k – $30k" change.
 * Skipped when the text already has the new words, so nothing is applied twice.
 */
export function replaceWithin(text: string, edits: TextEdit[]): string {
  let out = text;
  for (const [f, t] of [...edits].sort((x, y) => y[0].length - x[0].length)) {
    if (!t || f.length < 3 || !out.includes(f) || (t.includes(f) && out.includes(t))) continue;
    const re = new RegExp(`${/^\w/.test(f) ? "(?<![\\w])" : ""}${escRe(f)}${/\w$/.test(f) ? "(?![\\w])" : ""}`, "g");
    out = out.replace(re, () => t);
  }
  return out;
}

function applyList(items: string[], edits: TextEdit[]): string[] {
  // A whole bullet list that was retyped (lines added or removed).
  for (const [f, t] of edits) {
    const fl = f.split("\n").map(core).filter(Boolean);
    if (fl.length > 1 && fl.length === items.length && fl.every((x, i) => x === items[i].trim())) return t.split("\n").map(core).filter(Boolean);
  }
  return items.map((i) => applyText(i, edits)).filter((i) => i.trim());
}

/** The poster content with all text edits applied, for building new designs. */
export function applyContent(c: PosterContent, edits: TextEdit[]): PosterContent {
  if (!edits.length) return c;
  const out = { ...c } as Record<string, unknown>;
  for (const [k, v] of Object.entries(c)) {
    if (k === "qr") continue;
    if (typeof v === "string") out[k] = applyText(v, edits);
    else if (Array.isArray(v)) out[k] = applyList(v, edits);
  }
  return out as unknown as PosterContent;
}

/** Apply the edits to every text layer on a canvas. Returns true if anything changed. */
export function applyCanvas(canvas: any, edits: TextEdit[]): boolean {
  if (!edits.length) return false;
  let changed = false;
  const walk = (objs: any[], group?: any) => {
    for (const o of objs) {
      if (o.type === "group") walk(o.getObjects(), o);
      else if (typeof o.text === "string") {
        const t = applyText(o.text, edits);
        if (t !== o.text) {
          o.set({ text: t });
          o.initDimensions?.();
          if (group) group.triggerLayout?.();
          changed = true;
        }
      }
    }
  };
  walk(canvas.getObjects());
  if (changed) canvas.requestRenderAll?.();
  return changed;
}
