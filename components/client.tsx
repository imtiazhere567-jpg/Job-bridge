"use client";

import { askConfirm } from "./dialog";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Pencil } from "lucide-react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost px-3 py-1.5 text-[13px]"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : label}
    </button>
  );
}

export function Submit({ children, className = "btn btn-primary", pendingText, confirm }: { children: React.ReactNode; className?: string; pendingText?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      // A button that needs a "Yes" is a plain button, so a click before the page is ready does nothing
      // (a submit button would send the form straight away, skipping the question).
      type={confirm ? "button" : "submit"}
      className={className}
      disabled={pending}
      onClick={async (e) => {
        if (!confirm) return;
        const form = e.currentTarget.form;
        if (await askConfirm(confirm)) form?.requestSubmit();
      }}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

/** Shows text, with an inline editor that posts { field, value } to a server action. */
export function EditableText({ action, field, value, rows = 8, children }: { action: (form: FormData) => Promise<void>; field: string; value: string; rows?: number; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <div className="group relative">
        {children}
        <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost mt-3 px-3 py-1.5 text-[13px]">
          <Pencil size={13} /> Edit
        </button>
      </div>
    );
  return (
    <form
      action={async (f) => {
        await action(f);
        setEditing(false);
      }}
    >
      <input type="hidden" name="field" value={field} />
      <textarea name="value" defaultValue={value} rows={rows} className="field font-sans text-[14px] leading-relaxed" />
      <div className="mt-3 flex gap-2">
        <Submit pendingText="Saving…">Save</Submit>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
