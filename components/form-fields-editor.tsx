"use client";

import { useState } from "react";
import { Lock, Plus, Trash2, X } from "lucide-react";
import { Submit } from "@/components/client";
import { FIELD_LIBRARY, FIELD_TYPES, FORM_FIELDS, extraFields, fieldMode, type ExtraField, type FieldKey, type FieldMode, type FieldType, type FormFields } from "@/lib/form-fields";

const MODE_LABEL: Record<FieldMode, string> = { off: "Off", optional: "Optional", required: "Required" };
const GROUPS = Array.from(new Set(FIELD_LIBRARY.map((f) => f.group)));

/** Owner settings for one job's apply form: standard fields plus any fields added from the dropdown. */
export function FormFieldsEditor({ action, initial }: { action: (form: FormData) => Promise<void>; initial: FormFields | null }) {
  const [modes, setModes] = useState<Record<FieldKey, FieldMode>>(() => Object.fromEntries(FORM_FIELDS.map((f) => [f.key, fieldMode(initial, f.key)])) as Record<FieldKey, FieldMode>);
  const [extra, setExtra] = useState<ExtraField[]>(() => extraFields(initial));
  const [custom, setCustom] = useState<{ label: string; type: FieldType; options: string; required: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const change = () => setDirty(true);

  const add = (value: string) => {
    if (!value) return;
    if (value === "__custom") return setCustom({ label: "", type: "text", options: "", required: false });
    const lib = FIELD_LIBRARY.find((f) => f.id === value);
    if (!lib || extra.some((f) => f.id === lib.id)) return;
    setExtra((list) => [...list, { id: lib.id, label: lib.label, type: lib.type, mode: "optional", ...(lib.options ? { options: lib.options } : {}), ...(lib.placeholder ? { placeholder: lib.placeholder } : {}) }]);
    change();
  };
  const addCustom = () => {
    if (!custom?.label.trim()) return;
    const options = custom.options.split("\n").map((o) => o.trim()).filter(Boolean);
    if (custom.type === "select" && options.length < 2) return;
    setExtra((list) => [...list, { id: `c${Date.now().toString(36)}`, label: custom.label.trim(), type: custom.type, mode: custom.required ? "required" : "optional", ...(custom.type === "select" ? { options } : {}) }]);
    setCustom(null);
    change();
  };
  const unused = FIELD_LIBRARY.filter((f) => !extra.some((x) => x.id === f.id));
  const customOk = !!custom?.label.trim() && (custom.type !== "select" || custom.options.split("\n").filter((o) => o.trim()).length >= 2);

  return (
    <form action={async (fd) => { await action(fd); setDirty(false); }} className="card overflow-hidden">
      <input type="hidden" name="extra" value={JSON.stringify(extra)} />
      <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-shell lg:grid-cols-2 lg:divide-y-0">
        {[
          ["Full name", "Who is applying"],
          ["Phone / WhatsApp", "Needed to send updates and interview links"],
        ].map(([label, hint]) => (
          <Row key={label} label={label} hint={hint}>
            <span className="chip shrink-0 bg-pearl text-slate"><Lock size={11} /> Always asked</span>
          </Row>
        ))}
        {FORM_FIELDS.map((f) => (
          <Row key={f.key} label={f.label} hint={f.hint}>
            <Segmented name={f.key} options={f.modes} value={modes[f.key]} onChange={(m) => { setModes((s) => ({ ...s, [f.key]: m })); change(); }} />
          </Row>
        ))}
        {extra.map((f) => (
          <Row key={f.id} label={f.label} hint={`${FIELD_TYPES[f.type]}${f.options ? `: ${f.options.join(", ")}` : ""}`} added>
            <div className="flex shrink-0 items-center gap-1.5">
              <Segmented options={["optional", "required"]} value={f.mode} onChange={(m) => { setExtra((list) => list.map((x) => (x.id === f.id ? { ...x, mode: m as ExtraField["mode"] } : x))); change(); }} />
              <button type="button" title="Remove this field" aria-label={`Remove ${f.label}`} onClick={() => { setExtra((list) => list.filter((x) => x.id !== f.id)); change(); }} className="grid h-8 w-8 place-items-center rounded-lg border border-shell text-rust hover:border-rust"><Trash2 size={14} /></button>
            </div>
          </Row>
        ))}
      </ul>

      {/* Add a field */}
      <div className="border-t border-shell px-6 py-4">
        {!custom ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink"><Plus size={15} className="text-coral" /> Add a field</span>
            <select value="" onChange={(e) => add(e.target.value)} className="field w-auto min-w-[260px] py-2 text-[13.5px]" aria-label="Add a field">
              <option value="">Choose a field to add…</option>
              {GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {unused.filter((f) => f.group === g).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </optgroup>
              ))}
              <optgroup label="Your own">
                <option value="__custom">Custom field…</option>
              </optgroup>
            </select>
          </div>
        ) : (
          <div className="rounded-2xl border border-seafoam bg-mint/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13.5px] font-bold text-lagoon">New custom field</span>
              <button type="button" onClick={() => setCustom(null)} aria-label="Cancel" className="text-slate hover:text-rust"><X size={16} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div>
                <label className="label" htmlFor="cf-label">Question or field name</label>
                <input id="cf-label" autoFocus value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} className="field" placeholder="e.g. Which software do you use?" />
              </div>
              <div>
                <label className="label" htmlFor="cf-type">Answer type</label>
                <select id="cf-type" value={custom.type} onChange={(e) => setCustom({ ...custom, type: e.target.value as FieldType })} className="field">
                  {Object.entries(FIELD_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
            {custom.type === "select" && (
              <div className="mt-3">
                <label className="label" htmlFor="cf-opts">Choices <span className="font-normal text-slate">(one per line, at least 2)</span></label>
                <textarea id="cf-opts" rows={4} value={custom.options} onChange={(e) => setCustom({ ...custom, options: e.target.value })} className="field" placeholder={"Premiere Pro\nFinal Cut Pro\nDaVinci Resolve"} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={custom.required} onChange={(e) => setCustom({ ...custom, required: e.target.checked })} className="accent-lagoon" /> Required
              </label>
              <button type="button" onClick={addCustom} disabled={!customOk} className="btn btn-primary px-4 py-2 text-[13px] disabled:opacity-40"><Plus size={14} /> Add field</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-shell bg-pearl/60 px-6 py-4">
        <p className="text-[12.5px] text-slate">{dirty ? <span className="font-semibold text-coral">Unsaved changes. </span> : null}Applicants also tick a consent box. Answers show on the applicant&apos;s profile.</p>
        <Submit className="btn btn-primary" pendingText="Saving…">Save form fields</Submit>
      </div>
    </form>
  );
}

function Row({ label, hint, added, children }: { label: string; hint: string; added?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-shell px-6 py-4 lg:border-b lg:odd:border-r">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[14px] font-bold text-ink">{label}{added && <span className="chip bg-mint px-2 py-0.5 text-[10.5px] text-lagoon">Added</span>}</div>
        <div className="truncate text-[12.5px] text-slate">{hint}</div>
      </div>
      {children}
    </li>
  );
}

function Segmented({ name, options, value, onChange }: { name?: string; options: readonly FieldMode[]; value: FieldMode; onChange: (m: FieldMode) => void }) {
  return (
    <div className="flex shrink-0 rounded-xl border border-shell bg-pearl p-1">
      {options.map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${value === m ? "bg-lagoon text-white" : "text-slate hover:text-lagoon"}`}>
          {MODE_LABEL[m]}
        </button>
      ))}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
