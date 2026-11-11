"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Submit } from "@/components/client";
import { ScreeningAnswer } from "@/components/screening-row";
import type { ScreeningQuestion } from "@/lib/types";

export const MAX_SCREENING = 12;

type Item = { key: number; question: string; type: "yesno" | "text"; ideal: string };

/** The job's screening questions: only the real ones, with "Add question" and a remove button on each. */
export function ScreeningEditor({ action, initial }: { action: (form: FormData) => Promise<void>; initial: ScreeningQuestion[] }) {
  const [items, setItems] = useState<Item[]>(() =>
    initial.length ? initial.map((q, i) => ({ key: i, question: q.question, type: q.type, ideal: q.ideal ?? "" })) : [{ key: 0, question: "", type: "yesno", ideal: "" }],
  );
  const [next, setNext] = useState(initial.length + 1);
  const [dirty, setDirty] = useState(false);
  const [focusKey, setFocusKey] = useState<number | null>(null);

  const add = () => {
    setItems((list) => [...list, { key: next, question: "", type: "yesno", ideal: "" }]);
    setFocusKey(next);
    setNext((n) => n + 1);
    setDirty(true);
  };
  const remove = (key: number) => {
    setItems((list) => list.filter((x) => x.key !== key));
    setDirty(true);
  };

  return (
    <form action={async (fd) => { await action(fd); setDirty(false); }} onChange={() => setDirty(true)} className="card p-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((q, i) => (
          <div key={q.key} className="rounded-xl border border-shell bg-white p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-coral uppercase">Question {i + 1}</span>
              <button type="button" onClick={() => remove(q.key)} aria-label={`Remove question ${i + 1}`} title="Remove this question" className="grid h-7 w-7 place-items-center rounded-lg text-slate hover:bg-rust-soft hover:text-rust">
                <Trash2 size={14} />
              </button>
            </div>
            <textarea
              name={`q${i}`}
              rows={2}
              defaultValue={q.question}
              placeholder="Type your question…"
              autoFocus={focusKey === q.key}
              className="field text-[13.5px]"
            />
            <ScreeningAnswer index={i} type={q.type} ideal={q.ideal} />
          </div>
        ))}

        {items.length < MAX_SCREENING && (
          <button
            type="button"
            onClick={add}
            className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-shell bg-pearl/50 p-4 text-[13.5px] font-semibold text-lagoon hover:border-coral hover:bg-white hover:text-coral"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-[0_4px_12px_rgba(6,59,103,0.12)]"><Plus size={18} /></span>
            Add question
            <span className="text-[11.5px] font-normal text-slate">{items.length} of {MAX_SCREENING}</span>
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12.5px] text-slate">{dirty ? <span className="font-semibold text-coral">Unsaved changes. </span> : null}Empty questions are left out.</span>
        <Submit className="btn btn-primary" pendingText="Saving…">Save questions</Submit>
      </div>
    </form>
  );
}
