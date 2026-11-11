"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { CATEGORY, fontLabel, googleFonts, OWN_FONTS, previewFamily, type GFont } from "./fonts";

const PAGE = 60;

/** Font dropdown with every Google Font: search, filter by style, each name shown in its own font. */
export function FontPicker({ value, onPick }: { value: string; onPick: (family: string) => void }) {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState<GFont[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [shown, setShown] = useState(PAGE);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !fonts.length) googleFonts().then(setFonts);
  }, [open, fonts.length]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return fonts.filter((f) => (!cat || f[1] === cat) && (!t || f[0].toLowerCase().includes(t)));
  }, [fonts, q, cat]);

  const pick = (f: string) => {
    onPick(f);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="field flex w-44 items-center justify-between gap-2 py-1.5 text-left text-[13px]" aria-label="Font" aria-expanded={open}>
        <span className="truncate">{fontLabel(value)}</span>
        <ChevronDown size={14} className="shrink-0 text-slate" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1.5 w-[300px] overflow-hidden rounded-2xl border border-shell bg-white shadow-[0_18px_50px_rgba(6,59,103,0.22)]">
          <div className="border-b border-shell p-2.5">
            <div className="relative">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate" />
              <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder={`Search ${fonts.length ? fonts.length.toLocaleString("en-GB") : ""} Google Fonts`} className="field py-1.5 pl-8 text-[13px]" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {[["", "All"], ...Object.entries(CATEGORY)].map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setCat(k); setShown(PAGE); }} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cat === k ? "bg-lagoon text-white" : "bg-pearl text-slate hover:text-lagoon"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="max-h-[340px] overflow-y-auto py-1" onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) setShown((n) => Math.min(n + PAGE, matches.length)); }}>
            {!q && !cat && (
              <>
                <div className="px-3 pt-1.5 pb-1 text-[10.5px] font-bold tracking-wider text-coral uppercase">Brand fonts</div>
                {OWN_FONTS.map((f) => (
                  <Row key={f.id} active={value === f.id} onClick={() => pick(f.id)} style={{ fontFamily: f.id }}>{f.label}</Row>
                ))}
                <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-bold tracking-wider text-coral uppercase">Google Fonts</div>
              </>
            )}
            {!fonts.length && <p className="px-3 py-3 text-[12.5px] text-slate">Loading fonts…</p>}
            {fonts.length > 0 && !matches.length && <p className="px-3 py-3 text-[12.5px] text-slate">No font called &quot;{q}&quot;.</p>}
            {matches.slice(0, shown).map((f) => (
              <GoogleRow key={f[0]} font={f} active={value === f[0]} onClick={() => pick(f[0])} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ children, active, onClick, style, sub }: { children: React.ReactNode; active: boolean; onClick: () => void; style?: React.CSSProperties; sub?: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-pearl ${active ? "bg-mint" : ""}`}>
      <span className="min-w-0 flex-1 truncate text-[17px] text-ink" style={style}>{children}</span>
      {sub && <span className="shrink-0 text-[10.5px] text-slate">{sub}</span>}
      {active && <Check size={14} className="shrink-0 text-lagoon" />}
    </button>
  );
}

/** One Google Font, drawn in its own style once it scrolls into view. */
function GoogleRow({ font, active, onClick }: { font: GFont; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [alias, setAlias] = useState("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        previewFamily(font[0], font[2]).then(setAlias);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [font]);
  return (
    <div ref={ref}>
      <Row active={active} onClick={onClick} style={alias ? { fontFamily: `'${alias}', sans-serif` } : undefined} sub={CATEGORY[font[1]]}>{font[0]}</Row>
    </div>
  );
}
