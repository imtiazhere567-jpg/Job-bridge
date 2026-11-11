"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";

/**
 * Answer type + preferred answer for one screening question.
 * Yes/No questions can have a preferred answer (scored); short answers are written, so you read them instead.
 */
export function ScreeningAnswer({ index, type, ideal }: { index: number; type: "yesno" | "text"; ideal: string }) {
  const [t, setT] = useState(type);
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <select name={`t${index}`} value={t} onChange={(e) => setT(e.target.value as "yesno" | "text")} className="field py-1.5 text-[13px]" aria-label="Answer type">
          <option value="yesno">Yes / No</option>
          <option value="text">Short answer</option>
        </select>
        {t === "yesno" && (
          <select name={`i${index}`} defaultValue={ideal} className="field py-1.5 text-[13px]" aria-label="Preferred answer">
            <option value="">No preferred answer</option>
            <option value="yes">Preferred: Yes</option>
            <option value="no">Preferred: No</option>
          </select>
        )}
      </div>
      {t === "text" && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate">
          <PenLine size={12} className="shrink-0 text-coral" /> Written answer: not scored, you read it on the profile.
        </p>
      )}
    </div>
  );
}
