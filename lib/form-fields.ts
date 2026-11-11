/** What the apply form asks for a job. Name and phone are always asked (we reply on WhatsApp). */
export type FieldMode = "off" | "optional" | "required";

/** The standard fields every form has; each can be switched off, optional or required. */
export const FORM_FIELDS = [
  { key: "email", label: "Email", hint: "For the confirmation and interview emails", modes: ["off", "optional", "required"], default: "optional", placeholder: "" },
  { key: "city", label: "City / area", hint: "Where they live, to judge the commute", modes: ["off", "optional", "required"], default: "optional", placeholder: "e.g. Hackney, London" },
  { key: "cv", label: "CV upload", hint: "PDF or Word. The CV is what gets scored", modes: ["optional", "required"], default: "required", placeholder: "" },
] as const;
export type FieldKey = (typeof FORM_FIELDS)[number]["key"];

/** Answer types for added fields. */
export const FIELD_TYPES = {
  text: "Short answer",
  long: "Paragraph",
  yesno: "Yes / No",
  number: "Number",
  date: "Date",
  url: "Link",
  select: "Dropdown (choose one)",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;

export interface ExtraField {
  id: string;
  label: string;
  type: FieldType;
  mode: "optional" | "required";
  options?: string[];
  placeholder?: string;
}

/** Ready-made fields the owner can add from the "Add a field" dropdown. */
export const FIELD_LIBRARY: (Omit<ExtraField, "mode"> & { hint: string; group: string })[] = [
  { id: "portfolio", label: "LinkedIn or portfolio link", type: "url", placeholder: "https://", hint: "Design, web and creative jobs", group: "Experience" },
  { id: "current_title", label: "Current or last job title", type: "text", placeholder: "e.g. Customer Service Advisor", hint: "Quick read on their level", group: "Experience" },
  { id: "current_employer", label: "Current or last employer", type: "text", placeholder: "e.g. Tesco", hint: "Where they work now", group: "Experience" },
  { id: "years", label: "Years of experience", type: "number", placeholder: "e.g. 3", hint: "In this kind of work", group: "Experience" },
  { id: "qualification", label: "Highest qualification", type: "select", options: ["GCSEs", "A-levels", "BTEC / NVQ", "Degree", "Master's or higher", "Other"], hint: "Choose from a list", group: "Experience" },
  { id: "languages", label: "Languages you speak", type: "text", placeholder: "e.g. English, Polish", hint: "Useful for customer-facing jobs", group: "Experience" },
  { id: "salary", label: "Expected salary", type: "text", placeholder: "e.g. $28,000 a year", hint: "What they hope to earn", group: "Availability" },
  { id: "start", label: "When can you start?", type: "text", placeholder: "e.g. In 2 weeks", hint: "Start date", group: "Availability" },
  { id: "notice", label: "Notice period", type: "select", options: ["Can start now", "1 week", "2 weeks", "1 month", "More than 1 month"], hint: "Choose from a list", group: "Availability" },
  { id: "start_date", label: "Earliest start date", type: "date", hint: "Picks a date", group: "Availability" },
  { id: "weekends", label: "Can you work weekends?", type: "yesno", hint: "Yes / No", group: "Availability" },
  { id: "shifts", label: "Which shifts can you work?", type: "select", options: ["Days", "Evenings", "Nights", "Any shift"], hint: "Choose from a list", group: "Availability" },
  { id: "right_to_work", label: "Do you have the right to work in the UK?", type: "yesno", hint: "Yes / No", group: "Checks" },
  { id: "driving", label: "Do you have a full driving licence?", type: "yesno", hint: "Yes / No", group: "Checks" },
  { id: "transport", label: "Do you have your own transport?", type: "yesno", hint: "Yes / No", group: "Checks" },
  { id: "dbs", label: "Do you have a current DBS check?", type: "yesno", hint: "Yes / No", group: "Checks" },
  { id: "postcode", label: "Postcode", type: "text", placeholder: "e.g. EC1V 9BH", hint: "To check travel distance", group: "Checks" },
  { id: "cover", label: "Short cover note", type: "long", placeholder: "A few sentences is enough", hint: "Why they want the job", group: "About them" },
  { id: "why", label: "Why do you want to work with us?", type: "long", placeholder: "A few sentences is enough", hint: "Shows motivation", group: "About them" },
  { id: "heard", label: "How did you hear about this job?", type: "select", options: ["Facebook", "Instagram", "LinkedIn", "Indeed / Reed", "A friend", "Our website", "Other"], hint: "Choose from a list", group: "About them" },
];

export interface FormFields extends Partial<Record<FieldKey, FieldMode>> {
  extra?: ExtraField[];
}

export function fieldMode(fields: FormFields | null | undefined, key: FieldKey): FieldMode {
  const def = FORM_FIELDS.find((f) => f.key === key)!;
  const m = fields?.[key];
  return m && (def.modes as readonly string[]).includes(m) ? m : def.default;
}

const LEGACY = ["portfolio", "salary", "start", "cover"] as const;
/** Added fields, including ones saved by the earlier on/off version of this setting. */
export function extraFields(fields: FormFields | null | undefined): ExtraField[] {
  const out = [...(fields?.extra ?? [])];
  const raw = (fields ?? {}) as Record<string, unknown>;
  for (const k of LEGACY) {
    const m = raw[k];
    if ((m === "optional" || m === "required") && !out.some((f) => f.id === k)) {
      const lib = FIELD_LIBRARY.find((f) => f.id === k)!;
      out.push({ id: k, label: lib.label, type: lib.type, mode: m, placeholder: lib.placeholder });
    }
  }
  return out;
}

/** Clean up fields sent from the settings form. */
export function cleanExtra(input: unknown): ExtraField[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ExtraField[] = [];
  for (const r of input.slice(0, 20)) {
    if (!r || typeof r !== "object") continue;
    const f = r as Record<string, unknown>;
    const label = String(f.label ?? "").trim().slice(0, 140);
    const type = String(f.type ?? "text") as FieldType;
    let id = String(f.id ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 40);
    if (!label || !(type in FIELD_TYPES)) continue;
    if (!id || seen.has(id)) id = `c${Date.now().toString(36)}${out.length}`;
    seen.add(id);
    const options = type === "select" ? (Array.isArray(f.options) ? f.options : []).map((o) => String(o).trim().slice(0, 80)).filter(Boolean).slice(0, 20) : undefined;
    if (type === "select" && !options?.length) continue;
    out.push({ id, label, type, mode: f.mode === "required" ? "required" : "optional", ...(options ? { options } : {}), ...(f.placeholder ? { placeholder: String(f.placeholder).slice(0, 80) } : {}) });
  }
  return out;
}
