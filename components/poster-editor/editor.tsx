"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, Check, ChevronsDown, ChevronsUp, Copy, Download, FlipHorizontal, ImagePlus, LayoutTemplate,
  Lock, Palette, Redo2, RotateCcw, Save, Shapes, Shuffle, Trash2, Type, Undo2, Unlock, Upload,
} from "lucide-react";
import { ICONS } from "@/lib/poster-art";
import {
  bubbleSvg, buildDesign, chairSvg, DESIGNS, defaultVariant, FONTS, iconSvg, loadFonts, loadImg, megaphoneSvg, meshChairSvg, previewDesign, randomGen, randomVariant, SIZES, starSvg, svgUrl,
  type Brand, type DesignId, type PosterContent, type SizeId, type Variant,
} from "./build";
import { askConfirm } from "@/components/dialog";
import { FontPicker } from "./font-picker";
import { dataUrlBytes, makeZip } from "./zip";
import { loadDocFonts, loadFont } from "./fonts";
import { addEdit, applyCanvas, applyContent, mergeEdits, type TextEdit } from "./text-sync";

type Saved = Partial<Record<SizeId, { doc: string; design: DesignId }>>;
interface Props {
  content: PosterContent;
  brand: Brand;
  saved: Saved;
  /** Text changes made earlier; they apply to every size and design. */
  textEdits: TextEdit[];
  save: (form: FormData) => Promise<{ ok: boolean }>;
  remove: (size: SizeId) => Promise<void>;
  /** Save a text change into the job itself; returns extra pairs and the updated poster text. */
  syncText: (from: string, to: string, edits: TextEdit[]) => Promise<{ pairs: TextEdit[]; content: Partial<PosterContent> } | null>;
}

const KEEP = ["name", "selectable", "lockMovementX", "lockMovementY", "hasControls", "hoverCursor", "lockRotation", "lockScalingX", "lockScalingY"];
const WEIGHTS = [400, 500, 600, 700, 800, 900];
type Tab = "designs" | "text" | "elements" | "uploads" | "background";

export function PosterEditor({ content: initialContent, brand, saved, textEdits, save, remove, syncText }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLCanvasElement>(null);
  const F = useRef<any>(null);
  const cv = useRef<any>(null);
  const scale = useRef(1);
  const history = useRef<{ stack: string[]; at: number; paused: boolean }>({ stack: [], at: -1, paused: false });
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState<SizeId>("portrait");
  const sizeRef = useRef<SizeId>("portrait"); // always the size on screen (callbacks can't go stale)
  const [design, setDesign] = useState<DesignId>(saved.portrait?.design ?? "glass");
  const [variant, setVariant] = useState<Variant>(defaultVariant);
  const [tab, setTab] = useState<Tab>("designs");
  const [sel, setSel] = useState<any>(null);
  const [, setTick] = useState(0);
  const [previews, setPreviews] = useState<Partial<Record<DesignId, string>>>({});
  const [made, setMade] = useState<{ id: number; v: Variant; thumb: string }[]>([]); // designs from "New variation"
  const [madeSel, setMadeSel] = useState<number | null>(null);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "building">("");
  const [savedSizes, setSavedSizes] = useState<SizeId[]>(Object.keys(saved) as SizeId[]);
  const docs = useRef<Saved>(saved);
  // Unsaved work on each size, so switching sizes keeps your changes until you save.
  const work = useRef<Saved>({});
  // Sizes that should take the design you just picked (instead of their old saved one).
  const restyle = useRef<Set<SizeId>>(new Set());
  const [allDirty, setAllDirty] = useState(false);
  const designRef = useRef<DesignId>(saved.portrait?.design ?? "glass");
  const variantRef = useRef<Variant>(defaultVariant);
  const refresh = () => setTick((n) => n + 1);
  // Text edits: shared by every size, design and variation.
  const [edits, setEdits] = useState<TextEdit[]>(textEdits ?? []);
  const editsRef = useRef<TextEdit[]>(textEdits ?? []);
  const [textsDirty, setTextsDirty] = useState(false);
  // Job details on the poster (salary, title…). They update when a text change is saved into the job.
  const [content, setContent] = useState<PosterContent>(initialContent);
  const contentRef = useRef<PosterContent>(initialContent);
  const live = () => applyContent(contentRef.current, editsRef.current);
  const pending = useRef<{ from: string; to: string; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  /** Send a change to the job: the salary, description, captions and so on follow it. */
  const pushToJob = async (from: string, to: string) => {
    const res = await syncText(from, to, editsRef.current).catch(() => null);
    if (!res) return;
    const merged = mergeEdits(editsRef.current, res.pairs);
    editsRef.current = merged;
    setEdits(merged);
    contentRef.current = { ...contentRef.current, ...res.content };
    setContent(contentRef.current);
    if (cv.current && applyCanvas(cv.current, merged)) snapshot(); // e.g. the other wording of the salary on this poster
  };
  const commitText = (from: string, to: string, typing = false) => {
    if (from === to) return;
    const next = addEdit(editsRef.current, from, to);
    editsRef.current = next;
    setEdits(next);
    setTextsDirty(true);
    // Typing in a box sends once the typing stops; finishing an edit on the poster sends straight away.
    const p = pending.current;
    if (p && p.to === from) {
      p.to = to;
      if (p.timer) clearTimeout(p.timer);
    } else {
      if (p?.timer) {
        clearTimeout(p.timer);
        pushToJob(p.from, p.to);
      }
      pending.current = { from, to, timer: null };
    }
    const cur = pending.current!;
    const flush = () => {
      pending.current = null;
      pushToJob(cur.from, cur.to);
    };
    if (typing) cur.timer = setTimeout(flush, 800);
    else flush();
  };

  // ---------- history ----------
  const snapshot = useCallback(() => {
    const h = history.current;
    if (h.paused || !cv.current) return;
    const json = JSON.stringify(cv.current.toObject(KEEP));
    if (h.stack[h.at] === json) return;
    h.stack = h.stack.slice(0, h.at + 1);
    h.stack.push(json);
    if (h.stack.length > 60) h.stack.shift();
    h.at = h.stack.length - 1;
    refresh();
  }, []);
  const restore = async (json: string) => {
    const h = history.current;
    h.paused = true;
    await cv.current.loadFromJSON(JSON.parse(json));
    cv.current.renderAll();
    h.paused = false;
    setSel(null);
    refresh();
  };
  const undo = () => {
    const h = history.current;
    if (h.at > 0) restore(h.stack[--h.at]);
  };
  const redo = () => {
    const h = history.current;
    if (h.at < h.stack.length - 1) restore(h.stack[++h.at]);
  };
  const resetHistory = () => {
    history.current = { stack: [], at: -1, paused: false };
    snapshot();
  };

  // ---------- canvas size: fit the design in the available space ----------
  const fit = useCallback(() => {
    const c = cv.current;
    if (!c || !wrap.current) return;
    const { w, h } = SIZES[sizeRef.current];
    const box = wrap.current.getBoundingClientRect();
    const s = Math.min((box.width - 72) / w, (window.innerHeight * 0.72) / h, 1);
    scale.current = s;
    c.setDimensions({ width: Math.round(w * s), height: Math.round(h * s) });
    c.setZoom(s);
    c.requestRenderAll();
  }, []);

  // ---------- load a size: the saved poster, or a fresh design ----------
  const load = useCallback(
    async (s: SizeId, d: DesignId, v: Variant, fresh = false, keepUndo = false) => {
      const c = cv.current;
      if (!c) return;
      setStatus("building");
      history.current.paused = true;
      const savedDoc = fresh || restyle.current.has(s) ? undefined : work.current[s] ?? docs.current[s];
      if (savedDoc) {
        const json = JSON.parse(savedDoc.doc);
        await loadFonts();
        await loadDocFonts(json);
        await c.loadFromJSON(json);
      } else {
        await buildDesign(F.current, c, d, s, live(), brand, v);
      }
      applyCanvas(c, editsRef.current); // text changed on another size or design
      c.renderAll();
      history.current.paused = false;
      setSel(null);
      // A new design on the same size keeps Undo, so the previous design is one step back.
      if (keepUndo) snapshot();
      else resetHistory();
      setStatus("");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, brand],
  );

  // ---------- start up ----------
  useEffect(() => {
    let disposed = false;
    (async () => {
      const mod = await import("fabric");
      if (disposed || !el.current) return;
      F.current = mod;
      const c = new mod.Canvas(el.current, { preserveObjectStacking: true, selectionColor: "rgba(4,124,211,0.08)", selectionBorderColor: "#047CD3" });
      mod.FabricObject.ownDefaults.borderColor = "#047CD3";
      mod.FabricObject.ownDefaults.cornerColor = "#FFFFFF";
      mod.FabricObject.ownDefaults.cornerStrokeColor = "#047CD3";
      mod.FabricObject.ownDefaults.cornerStyle = "circle";
      mod.FabricObject.ownDefaults.transparentCorners = false;
      mod.FabricObject.ownDefaults.cornerSize = 12;
      // Draw every layer straight onto the canvas at the screen's resolution. With caching on, Fabric
      // draws text into a small bitmap first and stretches it, which made poster text look blurry.
      mod.FabricObject.ownDefaults.objectCaching = false;
      (mod.Group as any).ownDefaults && ((mod.Group as any).ownDefaults.objectCaching = false);
      cv.current = c;
      const onSel = () => setSel(c.getActiveObject() ?? null);
      c.on("selection:created", onSel);
      c.on("selection:updated", onSel);
      c.on("selection:cleared", () => setSel(null));
      c.on("object:modified", () => {
        snapshot();
        refresh();
      });
      c.on("text:changed", () => refresh());
      c.on("text:editing:entered", (e: any) => {
        if (e?.target) e.target.__before = e.target.text;
      });
      c.on("text:editing:exited", (e: any) => {
        const t = e?.target;
        if (t && typeof t.__before === "string" && t.__before !== t.text) commitText(t.__before, t.text);
        snapshot();
      });
      fit();
      await load("portrait", design, variant);
      setReady(true);
      // Previews for the Designs panel
      for (const d of DESIGNS) {
        if (disposed) return;
        const url = await previewDesign(mod, d.id, "portrait", live(), brand, defaultVariant, 200);
        setPreviews((p) => ({ ...p, [d.id]: url }));
      }
    })();
    return () => {
      disposed = true;
      cv.current?.dispose();
      cv.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a text change, redraw the design and variation thumbnails so they show the new text too.
  const madeRef = useRef(made);
  madeRef.current = made;
  useEffect(() => {
    if (!ready || !edits.length) return;
    let stop = false;
    const t = setTimeout(async () => {
      const c = applyContent(contentRef.current, edits);
      for (const d of DESIGNS) {
        if (stop) return;
        const url = await previewDesign(F.current, d.id, "portrait", c, brand, defaultVariant, 200);
        setPreviews((p) => ({ ...p, [d.id]: url }));
      }
      for (const m of madeRef.current) {
        if (stop) return;
        const thumb = await previewDesign(F.current, "custom", "portrait", c, brand, m.v, 200);
        setMade((list) => list.map((x) => (x.id === m.id ? { ...x, thumb } : x)));
      }
    }, 700);
    return () => {
      stop = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, ready, content]);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = cv.current;
      if (!c) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      const o = c.getActiveObject();
      if (o?.isEditing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d" && o) {
        e.preventDefault();
        duplicate();
      } else if ((e.key === "Delete" || e.key === "Backspace") && o) {
        e.preventDefault();
        del();
      } else if (o && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        o.set({ left: o.left + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0), top: o.top + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0) });
        o.setCoords();
        c.requestRenderAll();
        snapshot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- actions ----------
  const after = (o?: any) => {
    const c = cv.current;
    if (o) {
      c.setActiveObject(o);
      setSel(o);
    }
    c.requestRenderAll();
    snapshot();
  };
  const center = (o: any) => {
    const { w, h } = SIZES[sizeRef.current];
    o.set({ left: (w - o.getScaledWidth()) / 2, top: (h - o.getScaledHeight()) / 2 });
  };
  const addText = (kind: "heading" | "sub" | "body" | "script") => {
    const Fm = F.current;
    const spec = { heading: ["Add a heading", 96, 800, FONTS.head], sub: ["Add a subheading", 54, 700, FONTS.head], body: ["Add a little bit of body text", 32, 500, FONTS.body], script: ["Handwritten", 110, 400, FONTS.script] }[kind];
    const t = new Fm.Textbox(spec[0], { width: 640, fontSize: spec[1], fontWeight: spec[2], fontFamily: spec[3], fill: brand.primary, textAlign: "left" });
    t.name = "Text";
    center(t);
    cv.current.add(t);
    after(t);
  };
  const addShape = (kind: "rect" | "rounded" | "circle" | "line" | "pill" | "glass") => {
    const Fm = F.current;
    let o: any;
    if (kind === "circle") o = new Fm.Circle({ radius: 120, fill: brand.accent });
    else if (kind === "line") o = new Fm.Rect({ width: 400, height: 6, fill: brand.primary });
    else if (kind === "pill") o = new Fm.Rect({ width: 360, height: 90, rx: 45, ry: 45, fill: brand.accent });
    else if (kind === "glass") o = new Fm.Rect({ width: 560, height: 360, rx: 34, ry: 34, fill: "rgba(255,255,255,0.10)", stroke: "rgba(255,255,255,0.22)", strokeWidth: 2 });
    else o = new Fm.Rect({ width: 300, height: 300, rx: kind === "rounded" ? 36 : 0, ry: kind === "rounded" ? 36 : 0, fill: brand.primary });
    o.name = kind === "glass" ? "Glass card" : "Shape";
    center(o);
    cv.current.add(o);
    after(o);
  };
  const addImage = async (url: string, name: string, width: number) => {
    const Fm = F.current;
    const img = new Fm.FabricImage(await loadImg(url));
    img.scaleToWidth(width);
    img.name = name;
    center(img);
    cv.current.add(img);
    after(img);
  };
  const upload = (file: File) => {
    const r = new FileReader();
    r.onload = () => addImage(String(r.result), "Photo", 600);
    r.readAsDataURL(file);
  };
  const duplicate = async () => {
    const o = cv.current.getActiveObject();
    if (!o) return;
    const copy = await o.clone(KEEP);
    copy.set({ left: o.left + 30, top: o.top + 30 });
    cv.current.add(copy);
    after(copy);
  };
  const del = () => {
    const c = cv.current;
    const objs = c.getActiveObjects();
    objs.forEach((o: any) => o.name !== "Background" && c.remove(o));
    c.discardActiveObject();
    setSel(null);
    after();
  };
  const layer = (dir: "up" | "down" | "top" | "bottom") => {
    const c = cv.current;
    const o = c.getActiveObject();
    if (!o) return;
    if (dir === "up") c.bringObjectForward(o);
    if (dir === "down") c.sendObjectBackwards(o);
    if (dir === "top") c.bringObjectToFront(o);
    if (dir === "bottom") {
      c.sendObjectToBack(o);
      const bgObj = c.getObjects().find((x: any) => x.name === "Background");
      if (bgObj && bgObj !== o) c.sendObjectToBack(bgObj);
    }
    after();
  };
  const set = (props: Record<string, unknown>, target?: any) => {
    const o = target ?? cv.current.getActiveObject();
    if (!o) return;
    o.set(props);
    o.setCoords();
    cv.current.requestRenderAll();
    refresh();
    snapshot();
  };
  const setBackground = (fill: string) => {
    const bgObj = cv.current.getObjects().find((x: any) => x.name === "Background");
    if (bgObj) set({ fill }, bgObj);
  };
  /** A design choice is for the whole poster: every size follows it (saved when you press Save). */
  const applyDesignEverywhere = (d: DesignId, v: Variant) => {
    designRef.current = d;
    variantRef.current = v;
    setDesign(d);
    setVariant(v);
    work.current = {};
    restyle.current = new Set((Object.keys(SIZES) as SizeId[]).filter((x) => x !== sizeRef.current));
    setAllDirty(true);
  };
  const chooseDesign = async (d: DesignId, v: Variant = variant) => {
    // No question: your text changes carry over to every design, and Undo brings the old one back.
    setMadeSel(null);
    applyDesignEverywhere(d, v);
    await load(sizeRef.current, d, v, true, true);
  };
  /** A brand-new design: a fresh recipe that differs from the one on screen. */
  const shuffle = async () => {
    const v: Variant = { ...randomVariant(), gen: randomGen(variantRef.current.gen) };
    applyDesignEverywhere("custom", v);
    await load(sizeRef.current, "custom", v, true, true);
    const c = cv.current;
    const thumb = c.toDataURL({ format: "jpeg", quality: 0.75, multiplier: 200 / c.getWidth() });
    const id = Date.now();
    setMade((m) => [{ id, v, thumb }, ...m].slice(0, 12));
    setMadeSel(id);
  };
  const openMade = async (m: { id: number; v: Variant }) => {
    applyDesignEverywhere("custom", m.v);
    setMadeSel(m.id);
    await load(sizeRef.current, "custom", m.v, true, true);
  };
  const switchSize = async (s: SizeId) => {
    if (s === sizeRef.current) return;
    // Keep what is on screen for this size, so coming back shows it again.
    if (cv.current) {
      cv.current.discardActiveObject();
      work.current[sizeRef.current] = { doc: JSON.stringify(cv.current.toObject(KEEP)), design: designRef.current };
      restyle.current.delete(sizeRef.current);
    }
    sizeRef.current = s;
    setSize(s);
    const d = restyle.current.has(s) ? designRef.current : work.current[s]?.design ?? docs.current[s]?.design ?? designRef.current;
    setDesign(d);
    fit(); // resize the canvas to the new shape first, then fill it
    await load(s, d, variantRef.current);
    fit();
  };
  /** The poster on screen as a PNG at its exact platform size (e.g. 1080 × 1350), drawn off screen. */
  const exportPng = async () => {
    const c = cv.current;
    c.discardActiveObject();
    c.requestRenderAll();
    const { w, h } = SIZES[sizeRef.current];
    const sc = new F.current.StaticCanvas(document.createElement("canvas"), { width: w, height: h, enableRetinaScaling: false });
    await sc.loadFromJSON(c.toObject(KEEP));
    sc.renderAll();
    const png = sc.toDataURL({ format: "png", multiplier: 1 });
    sc.dispose();
    return png;
  };
  const download = async () => {
    const a = document.createElement("a");
    a.href = await exportPng();
    a.download = `jobbridge-poster-${size}.png`;
    a.click();
  };
  /** All four sizes in one zip, exactly as they look in the editor now (saved or not). */
  const [zipping, setZipping] = useState(false);
  const downloadAll = async () => {
    setZipping(true);
    try {
      const name = (contentRef.current.title || "poster").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const files: { name: string; data: Uint8Array }[] = [];
      for (const s of Object.keys(SIZES) as SizeId[]) {
        const png = s === sizeRef.current ? await exportPng() : (await renderOther(s)).png;
        const { w, h, label } = SIZES[s];
        files.push({ name: `${name}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${w}x${h}.png`, data: await dataUrlBytes(png) });
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(makeZip(files));
      a.download = `${name}-posters-all-sizes.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } finally {
      setZipping(false);
    }
  };
  const send = async (s: SizeId, d: DesignId, doc: string, png: string, quiet = false) => {
    const form = new FormData();
    form.set("size", s);
    form.set("design", d);
    form.set("texts", JSON.stringify(editsRef.current));
    if (quiet) form.set("quiet", "1");
    form.set("doc", new Blob([doc], { type: "application/json" }), "poster.json");
    form.set("png", await (await fetch(png)).blob(), "poster.png");
    const r = await save(form);
    if (r.ok) {
      docs.current = { ...docs.current, [s]: { doc, design: d } };
      setSavedSizes((list) => Array.from(new Set([...list, s])));
    }
    return r.ok;
  };
  /** Draw another size off screen with the current text, ready to save. */
  const renderOther = async (s: SizeId) => {
    const Fm = F.current;
    const { w, h } = SIZES[s];
    const sc = new Fm.StaticCanvas(document.createElement("canvas"), { width: w, height: h, enableRetinaScaling: false });
    const savedDoc = restyle.current.has(s) ? undefined : work.current[s] ?? docs.current[s];
    const d = savedDoc?.design ?? designRef.current;
    if (savedDoc) {
      const json = JSON.parse(savedDoc.doc);
      await loadFonts();
      await loadDocFonts(json);
      await sc.loadFromJSON(json);
    } else {
      await buildDesign(Fm, sc, d, s, live(), brand, variantRef.current);
    }
    applyCanvas(sc, editsRef.current);
    sc.renderAll();
    const out = { d, doc: JSON.stringify(sc.toObject(KEEP)), png: sc.toDataURL({ format: "png", multiplier: 1 }) };
    sc.dispose();
    return out;
  };
  const doSave = async () => {
    setStatus("saving");
    const ok = await send(size, designRef.current, JSON.stringify(cv.current.toObject(KEEP)), await exportPng());
    // Save the other sizes too when the design or text changed, or you edited them: every download then matches.
    if (ok) {
      const all = allDirty || (editsRef.current.length > 0 && textsDirty);
      for (const s of Object.keys(SIZES) as SizeId[]) {
        if (s === size || !(all || work.current[s] || restyle.current.has(s))) continue;
        const o = await renderOther(s);
        await send(s, o.d, o.doc, o.png, true);
      }
      work.current = {};
      restyle.current.clear();
      setAllDirty(false);
      setTextsDirty(false);
    }
    setStatus(ok ? "saved" : "");
  };
  const resetSize = async () => {
    if (!(await askConfirm("Start this size again from the design? Your edits for this size will be removed.", { yes: "Yes, start again" }))) return;
    await remove(size);
    delete docs.current[size];
    setSavedSizes((s) => s.filter((x) => x !== size));
    await load(size, design, variant, true);
  };

  // ---------- selection helpers ----------
  const textOf = (o: any): any => (!o ? null : o.type === "textbox" || o.type === "i-text" || o.type === "text" ? o : o.type === "group" ? o.getObjects().find((x: any) => x.type === "textbox" || x.type === "text") : null);
  const shapeOf = (o: any): any => (!o ? null : ["rect", "circle", "polygon", "path"].includes(o.type) ? o : o.type === "group" ? o.getObjects().find((x: any) => x.type === "rect") : null);
  const txt = textOf(sel);
  const shp = shapeOf(sel);
  const isGroup = sel?.type === "group";
  const setText = (props: Record<string, unknown>) => {
    if (!txt) return;
    if (typeof props.text === "string") commitText(txt.text, props.text, true);
    txt.set(props);
    if (isGroup) {
      txt.initDimensions?.();
      sel.triggerLayout?.();
    }
    set({}, sel);
  };
  const colorStr = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#063B67");

  const palette = [brand.primary, brand.accent, "#FFFFFF", "#0C1B2E", "#5DB6F7", "#E7F1FB", "#F4F4F1", "#25D366"];

  return (
    <div className="card overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-shell bg-white px-4 py-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-pearl p-1">
          {(Object.keys(SIZES) as SizeId[]).map((s) => (
            <button key={s} type="button" onClick={() => switchSize(s)} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${size === s ? "bg-lagoon text-white" : "text-slate hover:bg-white"}`}>
              {SIZES[s].label}
              {savedSizes.includes(s) && <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${size === s ? "bg-[#5db6f7]" : "bg-coral"}`} />}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <IconBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={history.current.at <= 0}><Undo2 size={16} /></IconBtn>
          <IconBtn title="Redo (Ctrl+Y)" onClick={redo} disabled={history.current.at >= history.current.stack.length - 1}><Redo2 size={16} /></IconBtn>
          {savedSizes.includes(size) && <button type="button" onClick={resetSize} className="btn btn-ghost px-3 py-1.5 text-[13px]"><RotateCcw size={14} /> Start over</button>}
          <button type="button" onClick={download} className="btn btn-ghost px-3 py-1.5 text-[13px]" title="This size only"><Download size={14} /> Download</button>
          <button type="button" onClick={downloadAll} disabled={zipping || !ready} className="btn btn-ghost px-3 py-1.5 text-[13px]" title="Instagram, Facebook, WhatsApp Status and LinkedIn in one zip">
            <Download size={14} /> {zipping ? "Preparing…" : "Download all (4 sizes)"}
          </button>
          {(allDirty || textsDirty) && <span className="text-[12px] font-semibold text-coral">{allDirty ? "Design changed on every size" : "Text changed on every size"} · save to keep it</span>}
          <button type="button" onClick={doSave} disabled={status === "saving" || !ready} className="btn btn-primary px-4 py-1.5 text-[13px]">
            {status === "saved" ? <Check size={15} /> : <Save size={15} />} {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save poster"}
          </button>
        </div>
      </div>

      <div className="grid min-h-[640px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[72px_280px_minmax(0,1fr)]">
        {/* Tabs rail */}
        <nav className="flex gap-1 overflow-x-auto border-b border-shell bg-deep p-2 lg:flex-col lg:items-center lg:overflow-visible lg:border-b-0 lg:px-0">
          {([["designs", "Designs", LayoutTemplate], ["text", "Text", Type], ["elements", "Elements", Shapes], ["uploads", "Uploads", Upload], ["background", "Colours", Palette]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-1 py-2.5 lg:w-14 lg:min-w-0 text-[10.5px] font-semibold ${tab === id ? "bg-white text-lagoon" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={19} /> {label}
            </button>
          ))}
        </nav>

        {/* Side panel */}
        <aside className="max-h-[78vh] overflow-y-auto border-b border-shell bg-white p-4 lg:border-r lg:border-b-0">
          {tab === "designs" && (
            <div className="space-y-3">
              <button type="button" onClick={shuffle} className="btn btn-primary w-full"><Shuffle size={15} /> New variation</button>
              <p className="text-[12px] text-slate">Every click makes a brand-new design in your brand colours, different from the one on screen.</p>
              {made.length > 0 && (
                <div>
                  <div className="label">Your variations</div>
                  <div className="grid grid-cols-2 gap-2">
                    {made.map((m, i) => (
                      <button key={m.id} type="button" onClick={() => openMade(m)} className={`relative overflow-hidden rounded-xl border-2 text-left ${madeSel === m.id && design === "custom" ? "border-coral ring-4 ring-coral/15" : "border-shell hover:border-seafoam"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.thumb} alt="" className="aspect-[4/5] w-full bg-pearl object-cover" />
                        {madeSel === m.id && design === "custom" && <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-coral text-white"><Check size={13} strokeWidth={3} /></span>}
                        <div className="px-2 py-1.5 text-[11.5px] font-bold text-ink">Variation {made.length - i}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="label pt-1">Ready-made styles</div>
              <div className="grid grid-cols-2 gap-2">
                {DESIGNS.map((d) => (
                  <button key={d.id} type="button" onClick={() => chooseDesign(d.id, defaultVariant)} className={`overflow-hidden rounded-xl border-2 text-left ${design === d.id ? "border-coral ring-4 ring-coral/15" : "border-shell hover:border-seafoam"}`}>
                    <div className="aspect-[4/5] bg-pearl">
                      {previews[d.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previews[d.id]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-[11px] text-slate">Loading…</div>
                      )}
                    </div>
                    <div className="px-2 py-1.5 text-[11.5px] font-bold text-ink">{d.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "text" && (
            <div className="space-y-2">
              <p className="mb-2 text-[12px] text-slate">Click to add, then double-click on the poster to type.</p>
              <button type="button" onClick={() => addText("heading")} className="w-full rounded-xl border border-shell px-4 py-3 text-left font-display text-[22px] font-extrabold text-ink hover:border-coral">Add a heading</button>
              <button type="button" onClick={() => addText("sub")} className="w-full rounded-xl border border-shell px-4 py-3 text-left font-display text-[16px] font-bold text-ink hover:border-coral">Add a subheading</button>
              <button type="button" onClick={() => addText("body")} className="w-full rounded-xl border border-shell px-4 py-3 text-left text-[13px] text-ink hover:border-coral">Add a little bit of body text</button>
              <button type="button" onClick={() => addText("script")} className="w-full rounded-xl border border-shell px-4 py-2 text-left text-[30px] text-ink hover:border-coral" style={{ fontFamily: FONTS.script }}>Handwritten</button>
              <div className="pt-3">
                <div className="label">Job details to add</div>
                <div className="flex flex-wrap gap-1.5">
                  {[content.title, content.salary, content.place, content.workMode, content.contact, content.link].filter(Boolean).map((t) => (
                    <button key={t} type="button" onClick={() => { addText("body"); setTimeout(() => { const o = cv.current.getActiveObject(); if (o) { o.set({ text: t }); cv.current.requestRenderAll(); snapshot(); } }, 0); }} className="chip border border-shell bg-pearl text-ink hover:border-coral">{t}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "elements" && (
            <div className="space-y-5">
              <section>
                <div className="label">Shapes</div>
                <div className="grid grid-cols-3 gap-2">
                  {([["rect", "Square"], ["rounded", "Rounded"], ["circle", "Circle"], ["pill", "Pill"], ["line", "Line"], ["glass", "Glass card"]] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => addShape(k)} className="flex flex-col items-center gap-1.5 rounded-xl border border-shell p-2.5 text-[11px] font-semibold text-slate hover:border-coral">
                      <span className={`block bg-lagoon ${k === "circle" ? "h-8 w-8 rounded-full" : k === "pill" ? "h-5 w-10 rounded-full" : k === "line" ? "h-1 w-10" : k === "rounded" ? "h-8 w-8 rounded-lg" : k === "glass" ? "h-7 w-10 rounded-md border border-lagoon/40 bg-lagoon/15" : "h-8 w-8"}`} />
                      {l}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <div className="label">Pictures</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Mesh chair", svgUrl(meshChairSvg(brand.accent)), 520],
                    ["Office chair", svgUrl(chairSvg(brand.primary)), 380],
                    ["Megaphone", svgUrl(megaphoneSvg("#5DB6F7", true)), 560],
                    ["Heart", svgUrl(bubbleSvg(brand.accent, "heart")), 200],
                    ["Like", svgUrl(bubbleSvg(brand.accent, "like")), 200],
                    ["Star bubble", svgUrl(bubbleSvg(brand.accent, "star")), 200],
                    ["Logo", "/brand/jobbridge-mark.png", 160],
                    ["Logo (white)", "/brand/jobbridge-mark-white.png", 160],
                    ["QR code", content.qr, 200],
                    ["Brand star", svgUrl(starSvg(brand.accent)), 140],
                  ].map(([l, u, w]) => (
                    <button key={l as string} type="button" onClick={() => addImage(u as string, l as string, w as number)} className="flex flex-col items-center gap-1 rounded-xl border border-shell bg-pearl p-2 text-[10.5px] font-semibold text-slate hover:border-coral">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u as string} alt="" className="h-12 w-12 object-contain" />
                      {l as string}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <div className="label">Icons</div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(ICONS).map(([k, v]) => (
                    <button key={k} type="button" title={v.label} onClick={() => addImage(svgUrl(iconSvg(k, brand.primary, 96)), v.label, 90)} className="grid place-items-center rounded-xl border border-shell p-2.5 hover:border-coral">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={svgUrl(iconSvg(k, brand.primary, 48))} alt={v.label} className="h-6 w-6" />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "uploads" && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-shell bg-pearl p-6 text-center hover:border-coral">
                <ImagePlus size={26} className="text-coral" />
                <span className="text-sm font-bold text-ink">Upload a picture</span>
                <span className="text-[12px] text-slate">PNG or JPG: a photo of your office, team or product.</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
          )}

          {tab === "background" && (
            <div className="space-y-4">
              <div>
                <div className="label">Background colour</div>
                <div className="flex flex-wrap gap-2">
                  {palette.map((c) => (
                    <button key={c} type="button" onClick={() => setBackground(c)} className="h-9 w-9 rounded-lg border border-shell" style={{ background: c }} aria-label={c} />
                  ))}
                  <input type="color" onChange={(e) => setBackground(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border border-shell" title="Any colour" />
                </div>
              </div>
              <p className="text-[12px] text-slate">To change the colour of any text or shape, click it on the poster and use the toolbar above it.</p>
            </div>
          )}
        </aside>

        {/* Canvas + contextual toolbar */}
        <section className="flex min-w-0 flex-col bg-pearl">
          <div className="flex min-h-[54px] flex-wrap items-center gap-2 border-b border-shell bg-white px-3 py-2">
            {!sel && <span className="text-[12.5px] text-slate">Click anything on the poster to edit it. Double-click text to type. Drag to move, use the corners to resize.</span>}
            {sel && (
              <>
                {txt && (
                  <>
                    {isGroup && <input value={txt.text} onChange={(e) => setText({ text: e.target.value })} className="field w-44 py-1.5 text-[13px]" aria-label="Text" />}
                    <FontPicker
                      value={txt.fontFamily}
                      onPick={async (family) => {
                        const target = txt;
                        setStatus("building");
                        await loadFont(family);
                        F.current.cache?.clearFontCache?.(family);
                        target.set({ fontFamily: family });
                        target.initDimensions?.();
                        if (isGroup) sel.triggerLayout?.();
                        set({}, sel);
                        setStatus("");
                      }}
                    />
                    <input type="number" min={8} max={600} value={Math.round(txt.fontSize)} onChange={(e) => setText({ fontSize: Number(e.target.value) || 12 })} className="field w-20 py-1.5 text-[13px]" aria-label="Font size" />
                    <select value={String(txt.fontWeight)} onChange={(e) => setText({ fontWeight: Number(e.target.value) })} className="field w-auto py-1.5 text-[13px]" aria-label="Weight">
                      {WEIGHTS.map((w) => <option key={w} value={w}>{w === 400 ? "Regular" : w === 500 ? "Medium" : w === 600 ? "Semi-bold" : w === 700 ? "Bold" : w === 800 ? "Extra-bold" : "Black"}</option>)}
                    </select>
                    <IconBtn title="Bold" onClick={() => setText({ fontWeight: Number(txt.fontWeight) >= 700 ? 500 : 800 })} active={Number(txt.fontWeight) >= 700}><Bold size={15} /></IconBtn>
                    <ColorInput title="Text colour" value={colorStr(txt.fill)} onChange={(v) => setText({ fill: v })} />
                    <IconBtn title="Align left" onClick={() => setText({ textAlign: "left" })} active={txt.textAlign === "left"}><AlignLeft size={15} /></IconBtn>
                    <IconBtn title="Align centre" onClick={() => setText({ textAlign: "center" })} active={txt.textAlign === "center"}><AlignCenter size={15} /></IconBtn>
                    <IconBtn title="Align right" onClick={() => setText({ textAlign: "right" })} active={txt.textAlign === "right"}><AlignRight size={15} /></IconBtn>
                    <Divider />
                  </>
                )}
                {shp && sel.name !== "Background" && (
                  <>
                    <ColorInput title={isGroup ? "Button colour" : "Fill colour"} value={colorStr(shp.fill)} onChange={(v) => { shp.set({ fill: v }); set({}, sel); }} />
                    {!isGroup && <ColorInput title="Border colour" value={colorStr(shp.stroke)} onChange={(v) => set({ stroke: v, strokeWidth: shp.strokeWidth || 3 })} />}
                    {shp.type === "rect" && !isGroup && (
                      <label className="flex items-center gap-1.5 text-[12px] text-slate">Corners
                        <input type="range" min={0} max={200} value={shp.rx ?? 0} onChange={(e) => set({ rx: Number(e.target.value), ry: Number(e.target.value) })} className="w-20 accent-lagoon" />
                      </label>
                    )}
                    <Divider />
                  </>
                )}
                {sel.name === "Background" && <ColorInput title="Background colour" value={colorStr(sel.fill)} onChange={(v) => set({ fill: v })} />}
                {sel.type === "image" && (
                  <>
                    <IconBtn title="Flip" onClick={() => set({ flipX: !sel.flipX })}><FlipHorizontal size={15} /></IconBtn>
                    <Divider />
                  </>
                )}
                <label className="flex items-center gap-1.5 text-[12px] text-slate">Opacity
                  <input type="range" min={5} max={100} value={Math.round((sel.opacity ?? 1) * 100)} onChange={(e) => set({ opacity: Number(e.target.value) / 100 })} className="w-20 accent-lagoon" />
                </label>
                {sel.name !== "Background" && (
                  <div className="ml-auto flex items-center gap-1">
                    <IconBtn title="Bring forward" onClick={() => layer("up")}><ArrowUp size={15} /></IconBtn>
                    <IconBtn title="Send backward" onClick={() => layer("down")}><ArrowDown size={15} /></IconBtn>
                    <IconBtn title="Bring to front" onClick={() => layer("top")}><ChevronsUp size={15} /></IconBtn>
                    <IconBtn title="Send to back" onClick={() => layer("bottom")}><ChevronsDown size={15} /></IconBtn>
                    <IconBtn title={sel.lockMovementX ? "Unlock" : "Lock position"} onClick={() => set({ lockMovementX: !sel.lockMovementX, lockMovementY: !sel.lockMovementX })} active={!!sel.lockMovementX}>{sel.lockMovementX ? <Lock size={15} /> : <Unlock size={15} />}</IconBtn>
                    <IconBtn title="Duplicate (Ctrl+D)" onClick={duplicate}><Copy size={15} /></IconBtn>
                    <IconBtn title="Delete" onClick={del} danger><Trash2 size={15} /></IconBtn>
                  </div>
                )}
              </>
            )}
          </div>
          <div ref={wrap} className="relative grid flex-1 place-items-center overflow-auto p-6">
            <div className="shadow-[0_12px_40px_rgba(6,59,103,0.18)]">
              <canvas ref={el} />
            </div>
            {(!ready || status === "building") && <div className="absolute inset-0 grid place-items-center bg-pearl/70 text-sm font-semibold text-lagoon">Building your poster…</div>}
          </div>
          <div className="border-t border-shell bg-white px-4 py-2 text-[11.5px] text-slate">
            Shortcuts: Ctrl+Z undo · Ctrl+Y redo · Ctrl+D duplicate · Delete remove · arrow keys nudge (Shift for bigger steps)
          </div>
        </section>
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, active, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={`grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-35 ${active ? "border-coral bg-mint text-lagoon" : danger ? "border-shell text-rust hover:border-rust" : "border-shell text-lagoon hover:border-coral"}`}>
      {children}
    </button>
  );
}
function ColorInput({ title, value, onChange }: { title: string; value: string; onChange: (v: string) => void }) {
  return (
    <label title={title} className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-shell">
      <span className="h-5 w-5 rounded-md border border-black/10" style={{ background: value }} />
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={title} />
    </label>
  );
}
const Divider = () => <span className="mx-1 h-6 w-px bg-shell" />;
