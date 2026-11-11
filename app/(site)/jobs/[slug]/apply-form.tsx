"use client";

import { useActionState, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { extraFields, fieldMode, type FormFields } from "@/lib/form-fields";
import type { ScreeningQuestion } from "@/lib/types";

const Opt = () => <span className="font-normal text-slate">(optional)</span>;

type Action = (state: unknown, form: FormData) => Promise<{ error: string } | undefined>;

export function ApplyForm({
  action,
  questions,
  fields,
  src,
  company,
  prefill,
  accent,
}: {
  action: Action;
  questions: ScreeningQuestion[];
  fields?: FormFields | null;
  src: string;
  company: string;
  prefill?: { name: string; email: string; phone: string | null };
  accent: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [file, setFile] = useState<string | null>(null);
  const mode = (k: Parameters<typeof fieldMode>[1]) => fieldMode(fields, k);
  const email = mode("email");
  const city = mode("city");
  const cv = mode("cv");
  const extras = extraFields(fields);
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="src" value={src} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <label className="label" htmlFor="name">Full name</label>
        <input id="name" name="name" required className="field" autoComplete="name" defaultValue={prefill?.name} />
      </div>
      <div className={`grid gap-4 ${email !== "off" ? "sm:grid-cols-2" : ""}`}>
        <div>
          <label className="label" htmlFor="phone">Phone / WhatsApp</label>
          <input id="phone" name="phone" required className="field" inputMode="tel" placeholder="07700 900123" autoComplete="tel" defaultValue={prefill?.phone ?? ""} />
        </div>
        {email !== "off" && (
          <div>
            <label className="label" htmlFor="email">Email {email === "optional" && <Opt />}</label>
            <input id="email" name="email" type="email" required={email === "required"} className="field" autoComplete="email" defaultValue={prefill?.email} />
          </div>
        )}
      </div>
      {city !== "off" && (
        <div>
          <label className="label" htmlFor="city">City / area {city === "optional" && <Opt />}</label>
          <input id="city" name="city" required={city === "required"} className="field" placeholder="e.g. Hackney, London" />
        </div>
      )}

      <div>
        <span className="label">Your CV {cv === "optional" && <Opt />}</span>
        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-5 ${file ? "border-seafoam bg-mint" : "border-shell bg-pearl hover:border-seafoam"}`}>
          {file ? <FileText size={22} className="text-lagoon" /> : <Upload size={22} className="text-slate" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{file ?? "Upload your CV"}</div>
            <div className="text-[12px] text-slate">PDF or Word (.docx), up to 4 MB</div>
          </div>
          <input
            type="file"
            name="cv"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required={cv === "required"}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
          />
        </label>
      </div>

      {extras.map((f) => {
        const id = `f_${f.id}`;
        const req = f.mode === "required";
        return (
          <div key={f.id}>
            {f.type === "yesno" ? <div className="label">{f.label} {!req && <Opt />}</div> : <label className="label" htmlFor={id}>{f.label} {!req && <Opt />}</label>}
            {f.type === "long" ? (
              <textarea id={id} name={id} rows={3} required={req} className="field" placeholder={f.placeholder} />
            ) : f.type === "yesno" ? (
              <div className="flex gap-2">
                {["Yes", "No"].map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded-full border border-shell bg-white px-4 py-2 text-sm has-[:checked]:border-lagoon has-[:checked]:bg-lagoon has-[:checked]:text-white">
                    <input type="radio" name={id} value={v} className="sr-only" required={req} />
                    {v}
                  </label>
                ))}
              </div>
            ) : f.type === "select" ? (
              <select id={id} name={id} required={req} defaultValue="" className="field">
                <option value="" disabled={req}>Choose…</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input id={id} name={id} type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text"} min={f.type === "number" ? 0 : undefined} required={req} className="field" placeholder={f.placeholder} />
            )}
          </div>
        );
      })}

      {questions.length > 0 && (
        <div className="space-y-4 rounded-xl bg-pearl p-5">
          <div className="eyebrow">A few quick questions</div>
          {questions.map((q) => (
            <div key={q.id}>
              <div className="mb-2 text-sm font-semibold text-ink">{q.question}</div>
              {q.type === "yesno" ? (
                <div className="flex gap-2">
                  {["yes", "no"].map((v) => (
                    <label key={v} className="flex cursor-pointer items-center gap-2 rounded-full border border-shell bg-white px-4 py-2 text-sm has-[:checked]:border-lagoon has-[:checked]:bg-lagoon has-[:checked]:text-white">
                      <input type="radio" name={q.id} value={v} className="sr-only" required />
                      {v === "yes" ? "Yes" : "No"}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea name={q.id} rows={3} className="field" placeholder="A few sentences is enough" />
              )}
            </div>
          ))}
        </div>
      )}

      <label className="flex items-start gap-3 text-[13px] text-slate">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-lagoon" />
        I agree that {company} can store my application and contact me about this and future roles.
      </label>

      {state?.error && <p className="rounded-lg bg-rust-soft px-3 py-2 text-sm font-medium text-rust">{state.error}</p>}
      <button className="btn w-full py-3.5 text-[15px] text-white" style={{ background: accent }} disabled={pending}>
        {pending ? "Sending your application…" : "Send application"}
      </button>
    </form>
  );
}
