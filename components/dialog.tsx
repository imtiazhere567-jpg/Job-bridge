"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileEdit, HelpCircle, RefreshCw, RotateCcw, Send, Trash2, X, XCircle, type LucideIcon } from "lucide-react";

/** An icon that matches what the box is asking about. */
function iconFor(title: string, danger: boolean): LucideIcon {
  if (/\b(delete|remove)/i.test(title)) return Trash2;
  if (/\brewrite/i.test(title)) return RefreshCw;
  if (/\b(replace|start .*again|reset)/i.test(title)) return RotateCcw;
  if (/\b(send|message|let them know)/i.test(title)) return Send;
  if (/\b(close|cancel|reject|not selected)/i.test(title)) return XCircle;
  if (/\bmove .*draft/i.test(title)) return FileEdit;
  return danger ? AlertTriangle : HelpCircle;
}

/**
 * Brand-styled confirm box, used instead of the browser's own pop-up.
 * Call askConfirm("Close this job? It will stop taking applications.") anywhere in client code.
 */
interface Ask {
  title: string;
  body: string;
  yes: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

let show: ((a: Ask) => void) | null = null;

const DANGER = /\b(delete|remove|reject|close|cancel|replace|discard|start (this size )?again|move this job back)/i;

/** Split "Question? More detail." into a title and a body, and pick a button label from the first word. */
function parse(message: string, opts: { title?: string; yes?: string; danger?: boolean }) {
  const m = message.match(/^(.+?\?)\s*(.*)$/s);
  const title = opts.title ?? (m ? m[1] : message);
  const body = opts.title ? message : m ? m[2] : "";
  const verb = title.match(/^([A-Z][a-z]+)/)?.[1];
  const yes = opts.yes ?? (verb && !/^(Do|Are|Is|Should|Would|Will|Can|This)$/.test(verb) ? `Yes, ${verb.toLowerCase()}` : "Yes, continue");
  return { title, body, yes, danger: opts.danger ?? DANGER.test(title) };
}

export function askConfirm(message: string, opts: { title?: string; yes?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    // Wait briefly for the dialog to be ready; never go ahead without asking.
    let tries = 0;
    const open = () => {
      if (show) return show({ ...parse(message, opts), resolve });
      if (++tries > 40) return resolve(false);
      setTimeout(open, 50);
    };
    open();
  });
}

/** Mounted once in the root layout. */
export function DialogHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const yesBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = (a) => setAsk(a);
    return () => {
      show = null;
    };
  }, []);

  const done = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  useEffect(() => {
    if (!ask) return;
    yesBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        done(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  if (!ask) return null;
  const Icon = iconFor(ask.title, ask.danger);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#041F38]/60 p-4 backdrop-blur-[4px]" onMouseDown={(e) => e.target === e.currentTarget && done(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body" className="w-full max-w-[420px] overflow-hidden rounded-[26px] bg-white shadow-[0_32px_90px_rgba(4,31,56,0.45)]">
        {/* Brand header: the JobBridge arc, with the icon in a glass circle */}
        <div className={`relative grid place-items-center overflow-clip px-6 pt-8 pb-7 ${ask.danger ? "bg-[linear-gradient(135deg,#7A1F1A_0%,#B3261E_55%,#D9534B_100%)]" : "bridge-gradient"}`}>
          <svg className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2" width="380" height="140" viewBox="0 0 380 140" aria-hidden="true">
            <path d="M10 140C60 10 320 10 370 140" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="34" />
            <path d="M90 140C120 60 260 60 290 140" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="14" />
          </svg>
          <button type="button" onClick={() => done(false)} aria-label="Close" className="absolute top-3.5 right-3.5 grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white">
            <X size={17} />
          </button>
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/15 ring-8 ring-white/10 backdrop-blur-sm">
            <span className={`grid h-11 w-11 place-items-center rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] ${ask.danger ? "text-rust" : "text-lagoon"}`}>
              <Icon size={21} strokeWidth={2.2} />
            </span>
          </span>
        </div>
        <div className="px-7 pt-6 pb-7 text-center">
          <h2 id="dlg-title" className="font-display text-[20px] leading-snug font-extrabold text-lagoon">{ask.title}</h2>
          {ask.body && <p id="dlg-body" className="mx-auto mt-2.5 max-w-[340px] text-[14px] leading-relaxed text-slate">{ask.body}</p>}
          <div className="mt-7 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => done(false)} className="rounded-xl border border-shell bg-white px-4 py-3 text-[14px] font-bold text-lagoon hover:border-lagoon/40 hover:bg-pearl">
              Cancel
            </button>
            <button
              ref={yesBtn}
              type="button"
              onClick={() => done(true)}
              className={`rounded-xl px-4 py-3 text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(6,59,103,0.22)] focus-visible:ring-4 focus-visible:outline-none ${ask.danger ? "bg-rust hover:bg-[#9E211A] focus-visible:ring-rust/25" : "bg-lagoon hover:bg-coral focus-visible:ring-coral/25"}`}
            >
              {ask.yes}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
