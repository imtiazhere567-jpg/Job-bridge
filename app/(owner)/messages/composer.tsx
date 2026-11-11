"use client";

import { useRef, useState } from "react";
import { SendHorizontal, Smartphone } from "lucide-react";

type Action = (form: FormData) => Promise<void>;

export function Composer({ reply, asApplicant, name }: { reply: Action; asApplicant?: Action; name: string }) {
  const [mode, setMode] = useState<"clinic" | "applicant">("clinic");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const action = mode === "clinic" || !asApplicant ? reply : asApplicant;
  return (
    <div className="border-t border-shell bg-[#F0F2F5] px-3 py-3">
      {asApplicant && (
        <div className="mb-2 flex gap-1 text-[12px]">
          <button type="button" onClick={() => setMode("clinic")} className={`rounded-full px-3 py-1 font-semibold ${mode === "clinic" ? "bg-lagoon text-white" : "bg-white text-slate"}`}>
            Reply as clinic
          </button>
          <button type="button" onClick={() => setMode("applicant")} className={`flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${mode === "applicant" ? "bg-coral text-white" : "bg-white text-slate"}`}>
            <Smartphone size={12} /> Reply as {name.split(" ")[0]} (demo)
          </button>
        </div>
      )}
      <form
        ref={ref}
        action={async (f) => {
          setBusy(true);
          await action(f);
          ref.current?.reset();
          setBusy(false);
        }}
        className="flex items-end gap-2"
      >
        <textarea
          name="text"
          rows={1}
          required
          placeholder={mode === "clinic" ? "Type a WhatsApp message" : `Type what ${name.split(" ")[0]} would send, e.g. "Can I change my interview time?"`}
          className="max-h-32 min-h-[42px] flex-1 resize-y rounded-[10px] border-0 bg-white px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-seafoam"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ref.current?.requestSubmit();
            }
          }}
        />
        <button disabled={busy} className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-white disabled:opacity-50 ${mode === "clinic" ? "bg-[#00A884]" : "bg-coral"}`} aria-label="Send">
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  );
}
