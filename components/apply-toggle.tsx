"use client";

import { useRef, useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";

/** Swaps the apply form for the full job description (and back) in the same place. The form stays filled in. */
export function ApplyToggle({ form, details }: { form: React.ReactNode; details: React.ReactNode }) {
  const [view, setView] = useState<"form" | "details">("form");
  const top = useRef<HTMLDivElement>(null);
  const show = (v: "form" | "details") => {
    setView(v);
    top.current?.scrollIntoView({ block: "start" });
  };
  return (
    <div ref={top} className="scroll-mt-4">
      <div className={view === "form" ? "" : "hidden"}>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold text-lagoon">Apply in about 3 minutes</h2>
          <button type="button" onClick={() => show("details")} className="flex items-center gap-1.5 text-[13px] font-semibold text-coral hover:underline">
            <FileText size={14} /> Read the full job description
          </button>
        </div>
        {form}
      </div>
      {view === "details" && (
        <div>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-lagoon">Job description</h2>
            <button type="button" onClick={() => show("form")} className="flex items-center gap-1.5 text-[13px] font-semibold text-coral hover:underline">
              <ArrowLeft size={14} /> Back to the application form
            </button>
          </div>
          {details}
          <button type="button" onClick={() => show("form")} className="btn btn-primary mt-6 w-full py-3.5 text-[15px]">
            Apply for this job
          </button>
        </div>
      )}
    </div>
  );
}
