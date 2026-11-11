"use server";

import { cleanExtra, FORM_FIELDS, type FieldMode, type FormFields } from "@/lib/form-fields";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiEnabled, draftRoleWithAI, generateJobPost } from "@/lib/ai";
import { applyAnswers, DRAFT_FIELDS, emptyDraft, missingQuestions, readJobText, suggestSkills, type DraftField, type DraftResult, type RoleDraft } from "@/lib/role-draft";
import { TEMPLATE_STYLES, templateJobPost, WORK_MODES } from "@/lib/jobpost";
import { hiredCount, newRoleCode, rememberSlug, uniqueSlug } from "@/lib/hiring";
import { rescore } from "@/lib/intake";
import { logActivity } from "@/lib/messages";
import { ownRole } from "@/lib/owner";
import { reject } from "../applicants/actions";
import { brandOf, designFor, sanitize } from "@/lib/poster";
import { syncPosterText } from "@/lib/poster-sync";
import type { Company, Role, ScreeningQuestion } from "@/lib/types";

const j = (v: unknown) => JSON.stringify(v);
const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/\n|,(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
const int = (v: FormDataEntryValue | null) => {
  const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};

function readRole(form: FormData) {
  return {
    title: String(form.get("title") ?? "").trim(),
    department: String(form.get("department") ?? "").trim() || null,
    employment: String(form.get("employment") ?? "Full-time"),
    work_mode: (WORK_MODES as readonly string[]).includes(String(form.get("work_mode"))) ? String(form.get("work_mode")) : "On-site",
    shift: String(form.get("shift") ?? "").trim() || null,
    hours: String(form.get("hours") ?? "").trim() || null,
    salary_min: int(form.get("salary_min")),
    salary_max: int(form.get("salary_max")),
    salary_period: form.get("salary_period") === "month" ? "month" : "year",
    location: String(form.get("location") ?? "").trim() || null,
    city: String(form.get("city") ?? "").trim() || null,
    openings: Math.min(100, Math.max(1, int(form.get("openings")) ?? 1)),
    languages: lines(form.get("languages")),
    min_experience: int(form.get("min_experience")) ?? 0,
    duties: String(form.get("duties") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    must_have: lines(form.get("must_have")),
    nice_to_have: lines(form.get("nice_to_have")),
    start_date: String(form.get("start_date") ?? "") || null,
    notes: String(form.get("notes") ?? "").trim() || null,
  };
}

async function writePost(role: Role, company: Company, style = 0) {
  const post = await generateJobPost(role, company, style);
  await db.q(
    `update roles set description=$2, post_facebook=$3, post_instagram=$4, post_whatsapp=$5, post_linkedin=$6, poster_headline=$7, poster_tagline=$8, screening=$9, written_by=$10, updated_at=now() where id=$1`,
    [role.id, post.description, post.facebook, post.instagram, post.whatsapp, post.linkedin, post.poster_headline, post.poster_tagline, j(post.screening), post.written_by],
  );
}

/** New job: the assistant writes the post and poster text; it starts as a draft. */
export async function createRole(_: unknown, form: FormData) {
  const { company } = await requireEmployer();
  const r = readRole(form);
  if (!r.title) return { error: "Please give the role a title." };
  if (!r.must_have.length) return { error: "Add at least one must-have skill so applicants can be scored." };
  const slug = await uniqueSlug("roles", r.title);
  const row = (await db.one<Role>(
    `insert into roles (company_id, slug, code, title, department, employment, shift, hours, salary_min, salary_max, location, city, openings, languages, min_experience, duties, must_have, nice_to_have, start_date, notes, work_mode, salary_period, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'draft') returning *`,
    [company.id, slug, await newRoleCode(), r.title, r.department, r.employment, r.shift, r.hours, r.salary_min, r.salary_max, r.location, r.city ?? company.city, r.openings,
      j(r.languages), r.min_experience, j(r.duties), j(r.must_have), j(r.nice_to_have), r.start_date, r.notes, r.work_mode, r.salary_period],
  ))!;
  await writePost(row, company);
  // The description written (and maybe edited) on the New job page is the one that is kept.
  const desc = String(form.get("description") ?? "").trim();
  if (desc) await db.q("update roles set description = $2 where id = $1", [row.id, desc.slice(0, 20000)]);
  await logActivity(db, `Job created (draft): ${r.title}`, row.id);
  redirect(`/roles/${row.slug}?created=1`);
}

export async function updateRole(id: number, _: unknown, form: FormData) {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  const r = readRole(form);
  if (!r.title) return { error: "Please give the role a title." };
  if (r.openings < (await hiredCount(id))) return { error: "Openings can't be lower than the number of people already hired." };
  await db.q(
    `update roles set title=$2, department=$3, employment=$4, shift=$5, hours=$6, salary_min=$7, salary_max=$8, location=$9, city=$10, openings=$11, languages=$12, min_experience=$13,
       duties=$14, must_have=$15, nice_to_have=$16, start_date=$17, notes=$18, status=$19, work_mode=$20, salary_period=$21, updated_at=now() where id=$1`,
    [id, r.title, r.department, r.employment, r.shift, r.hours, r.salary_min, r.salary_max, r.location, r.city ?? company.city, r.openings, j(r.languages), r.min_experience,
      j(r.duties), j(r.must_have), j(r.nice_to_have), r.start_date, r.notes, role.status, r.work_mode, r.salary_period],
  );
  if (form.get("rescore") === "on") {
    const ids = await db.q<{ id: number }>("select id from applicants where role_id = $1", [id]);
    for (const a of ids) await rescore(a.id);
  }
  // Keep the web address in step with the job title.
  const slug = r.title === role.title ? role.slug : await uniqueSlug("roles", r.title, id);
  if (slug !== role.slug) {
    await rememberSlug(id, role.slug);
    await db.q("update roles set slug = $2 where id = $1", [id, slug]);
  }
  revalidatePath("/roles", "layout");
  redirect(`/roles/${slug}?saved=1`);
}

export async function regeneratePost(id: number) {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  // Without Claude, move to the next template wording so the rewrite is visibly different.
  const now = Array.from({ length: TEMPLATE_STYLES }, (_, i) => templateJobPost(role, company, i).description).indexOf(role.description ?? "");
  const style = (now + 1) % TEMPLATE_STYLES;
  await writePost(role, company, style);
  revalidatePath("/roles", "layout");
  redirect(`/roles/${role.slug}?rewritten=${aiEnabled() ? "ai" : `style-${style + 1}`}`);
}

export async function savePost(id: number, form: FormData) {
  const { company } = await requireEmployer();
  await ownRole(id, company.id);
  const field = String(form.get("field"));
  const allowed = ["description", "post_facebook", "post_instagram", "post_whatsapp", "post_linkedin", "poster_headline", "poster_tagline"];
  if (!allowed.includes(field)) return;
  await db.q(`update roles set ${field} = $2, updated_at = now() where id = $1`, [id, String(form.get("value") ?? "").slice(0, 6000)]);
  revalidatePath("/roles", "layout");
}

export async function saveScreening(id: number, form: FormData) {
  const { company } = await requireEmployer();
  await ownRole(id, company.id);
  const qs: ScreeningQuestion[] = [];
  for (let i = 0; i < 12; i++) {
    const question = String(form.get(`q${i}`) ?? "").trim();
    if (!question) continue;
    const type = form.get(`t${i}`) === "text" ? "text" : "yesno";
    const ideal = form.get(`i${i}`);
    qs.push({ id: `q${qs.length + 1}`, question, type, ...(type === "yesno" && (ideal === "yes" || ideal === "no") ? { ideal } : {}) });
  }
  await db.q("update roles set screening = $2, updated_at = now() where id = $1", [id, j(qs)]);
  revalidatePath("/roles", "layout");
}

/** Which optional fields the apply form shows for this job. */
export async function saveFormFields(id: number, form: FormData) {
  const { company } = await requireEmployer();
  await ownRole(id, company.id);
  const fields: FormFields = {};
  for (const f of FORM_FIELDS) {
    const m = String(form.get(f.key) ?? "");
    if ((f.modes as readonly string[]).includes(m)) fields[f.key] = m as FieldMode;
  }
  try {
    fields.extra = cleanExtra(JSON.parse(String(form.get("extra") ?? "[]")));
  } catch {
    fields.extra = [];
  }
  await db.q("update roles set form_fields = $2, updated_at = now() where id = $1", [id, j(fields)]);
  revalidatePath("/roles", "layout");
}

/** Publish a draft, close a live job, or reopen a closed one. */
export async function setStatus(id: number, action: "publish" | "close" | "reopen" | "draft") {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  if (action === "publish" && role.status === "draft") {
    await db.q("update roles set status = 'open', reviewed_at = now(), updated_at = now() where id = $1", [id]);
    await logActivity(db, `Published: ${role.title} is live on the careers site`, id);
  }
  if (action === "close" && role.status === "open") {
    await db.q("update roles set status = 'closed', closed_reason = 'manual', updated_at = now() where id = $1", [id]);
    await logActivity(db, `Role closed: ${role.title}`, id);
  }
  if (action === "reopen" && role.status === "closed") {
    if ((await hiredCount(id)) >= role.openings) return;
    await db.q("update roles set status = 'open', closed_reason = null, reviewed_at = now(), updated_at = now() where id = $1", [id]);
    await logActivity(db, `Reopened: ${role.title}`, id);
  }
  if (action === "draft" && (role.status === "open" || role.status === "closed")) {
    // Back to draft: hidden from the public again, applicants are kept, publish again when ready.
    await db.q("update roles set status = 'draft', closed_reason = null, updated_at = now() where id = $1", [id]);
    await logActivity(db, `Moved back to draft: ${role.title}`, id);
  }
  revalidatePath("/roles", "layout");
  revalidatePath("/roles");
}

/** After a role closes: politely tell everyone still waiting (the owner presses the button). */
export async function notifyRemaining(id: number) {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  if (role.status !== "closed") return;
  const rows = await db.q<{ id: number }>("select id from applicants where role_id = $1 and stage not in ('hired','rejected')", [id]);
  const form = new FormData();
  rows.forEach((r) => form.append("ids", String(r.id)));
  await reject(form);
  revalidatePath("/roles", "layout");
}

const POSTER_SIZES = ["portrait", "square", "story", "linkedin"];

/** Poster editor: save the edited poster for one size (layers to keep editing + the finished PNG). */
export async function savePosterEdit(id: number, form: FormData) {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  // The image and layers arrive as files: big text arguments are refused by the server action decoder.
  const size = String(form.get("size") ?? "");
  const design = String(form.get("design") ?? "glass");
  const pngFile = form.get("png");
  const docFile = form.get("doc");
  if (!POSTER_SIZES.includes(size) || !(pngFile instanceof Blob) || !(docFile instanceof Blob) || pngFile.size > 8_000_000) return { ok: false };
  const png = `data:image/png;base64,${Buffer.from(await pngFile.arrayBuffer()).toString("base64")}`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await docFile.text());
  } catch {
    return { ok: false };
  }
  await db.q(
    `insert into poster_images (role_id, size, design, doc, png, updated_at) values ($1,$2,$3,$4,$5, now())
     on conflict (role_id, size) do update set design = excluded.design, doc = excluded.doc, png = excluded.png, updated_at = now()`,
    [id, size, design.slice(0, 20), j(parsed), png.slice("data:image/png;base64,".length)],
  );
  // Text changes made in the editor apply to every size and design.
  let texts: [string, string][] | null = null;
  try {
    const t = JSON.parse(String(form.get("texts") ?? "null"));
    if (Array.isArray(t)) texts = t.filter((x) => Array.isArray(x) && x.length === 2 && x.every((y) => typeof y === "string")).slice(0, 300).map((x) => [x[0].slice(0, 2000), x[1].slice(0, 2000)]);
  } catch {}
  if (texts) await db.q("update roles set poster_texts = $2, updated_at = now() where id = $1", [id, j(texts)]);
  else await db.q("update roles set updated_at = now() where id = $1", [id]);
  if (!form.get("quiet")) await logActivity(db, `Poster edited for ${role.title}`, id);
  revalidatePath("/roles", "layout");
  return { ok: true };
}

/** Poster editor: forget the edits for one size (it goes back to the design). */
export async function removePosterEdit(id: number, size: string) {
  const { company } = await requireEmployer();
  await ownRole(id, company.id);
  await db.q("delete from poster_images where role_id = $1 and size = $2", [id, size]);
  await db.q("update roles set updated_at = now() where id = $1", [id]);
  revalidatePath("/roles", "layout");
}

/** Poster studio: save the chosen design with its text and colours. */
export async function savePoster(id: number, json: string) {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  let design;
  try {
    design = sanitize(JSON.parse(json), designFor(role, brandOf(company)));
  } catch {
    return { ok: false };
  }
  await db.q("update roles set poster = $2, updated_at = now() where id = $1", [id, j(design)]);
  await logActivity(db, `Poster saved for ${role.title}`, id);
  revalidatePath("/roles", "layout");
  return { ok: true };
}

/** Poster studio: ask the assistant for a fresh headline and tagline. */
export async function rewritePosterText(id: number) {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  const post = await generateJobPost(role, company);
  await db.q("update roles set poster_headline = $2, poster_tagline = $3, updated_at = now() where id = $1", [id, post.poster_headline, post.poster_tagline]);
  return { headline: post.poster_headline, tagline: post.poster_tagline };
}

/**
 * New job assistant: read the owner's description (plus answers to earlier questions)
 * and return form values and questions about anything important that is missing.
 */
export async function draftRole(text: string, answers: { field: string; question: string; answer: string }[], skip: string[]): Promise<DraftResult> {
  const { company } = await requireEmployer();
  const valid = (f: string): f is DraftField => (DRAFT_FIELDS as readonly string[]).includes(f);
  const skipped = skip.filter(valid);
  const answered = answers.filter((a) => valid(a.field) && a.answer.trim()) as { field: DraftField; question: string; answer: string }[];
  const description = text.slice(0, 8000);
  const qa = answered.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n");
  const full = answered.length ? `${description}\n\nAnswers to your questions:\n${qa}` : description;
  const ai = await draftRoleWithAI(full, company, skipped);
  if (ai) return ai;
  const draft = applyAnswers(readJobText(description), answered);
  // No skills given: suggest the usual ones for the job title (shown as suggestions to check).
  const suggested: DraftField[] = [];
  if (!draft.must_have.length && !answered.some((a) => a.field === "must_have")) {
    draft.must_have = suggestSkills(draft.title);
    if (draft.must_have.length) suggested.push("must_have");
  }
  return { draft, questions: missingQuestions(draft).filter((q) => !skipped.includes(q.field)), by: "rules", suggested };
}

/** Poster editor: a text change on a poster is saved into the job too (salary, title, description, captions…). */
export async function syncPosterTextEdit(id: number, from: string, to: string, edits: [string, string][]) {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  if (typeof from !== "string" || typeof to !== "string" || from.length > 4000 || to.length > 4000) return null;
  const clean = (Array.isArray(edits) ? edits : []).filter((e) => Array.isArray(e) && e.length === 2 && e.every((x) => typeof x === "string")).slice(-300);
  const res = await syncPosterText(role, company, from, to, clean);
  revalidatePath("/roles", "layout");
  return res;
}

/** Delete a job for good, with its applicants, interviews, messages and posters. */
export async function deleteRole(id: number) {
  const { company } = await requireEmployer();
  const role = await ownRole(id, company.id);
  await db.tx(async (t) => {
    await t.q("delete from activity where role_id = $1", [id]);
    await t.q("delete from roles where id = $1", [id]); // applicants, interviews, messages, posters and old links go with it
  });
  await logActivity(db, `Job deleted: ${role.title}`, null, null, company.id);
  revalidatePath("/", "layout");
  redirect(`/roles?deleted=${encodeURIComponent(role.title)}`);
}

// ---------------- New job assistant (chat) ----------------

export interface AssistantReply {
  /** Fields the assistant changed this turn (only these are written into the form). */
  draft: RoleDraft | null;
  questions: { field: DraftField; question: string }[];
  suggested: DraftField[];
  /** Fields to empty: old suggestions that no longer fit the job. */
  clear: DraftField[];
  /** A newly written job description, when one was asked for or the job details changed. */
  description: string | null;
  by: "claude" | "rules";
  /** What the assistant says back, in plain words. */
  note: string;
}

const WANTS_DESCRIPTION = /\b(write|draft|create|generate|make|redo|rewrite|give me)\b[^.?!]{0,40}\b(description|job post|post|advert|ad)\b|^\s*(the\s+)?(job\s+)?description\s*[.!?]?\s*$/i;
const TITLE_CUE = /\b(position|role|job title|title|hiring|hire|need|needs|looking for|require|requires|want|wanted)\b/i;
const COUNT_CUE = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?!years?|yrs?|months?|days?|hours?|am|pm|k\b)[a-z]/i;

/** The form as a draft. Only fields the owner (or the assistant) has touched count as filled. */
function formDraft(form: FormData, touched: Set<string>): RoleDraft {
  const r = readRole(form);
  const has = (f: string) => touched.has(f);
  const d = emptyDraft();
  if (has("title") && r.title) d.title = r.title;
  if (has("department")) d.department = r.department;
  if (has("employment")) d.employment = r.employment as RoleDraft["employment"];
  if (has("work_mode")) d.work_mode = r.work_mode as RoleDraft["work_mode"];
  if (has("shift")) d.shift = r.shift;
  if (has("hours")) d.hours = r.hours;
  if (has("salary_min")) d.salary_min = r.salary_min;
  if (has("salary_max")) d.salary_max = r.salary_max;
  if (has("salary_period") || has("salary_min") || has("salary_max")) d.salary_period = r.salary_period as RoleDraft["salary_period"];
  if (has("location")) d.location = r.location;
  if (has("city")) d.city = r.city;
  if (has("openings")) d.openings = r.openings;
  if (has("start_date")) d.start_date = r.start_date;
  if (has("duties")) d.duties = r.duties;
  if (has("must_have")) d.must_have = r.must_have;
  if (has("nice_to_have")) d.nice_to_have = r.nice_to_have;
  if (has("languages")) d.languages = r.languages;
  if (has("min_experience")) d.min_experience = r.min_experience;
  if (has("notes")) d.notes = r.notes;
  return d;
}

/** Lay the new details over the current ones (empty new values keep what is there). */
function overlay(base: RoleDraft, next: RoleDraft): RoleDraft {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(next)) {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = v;
  }
  return out as unknown as RoleDraft;
}

/** Write the job description from the form's details (Claude when connected, else the built-in writer). */
async function describe(form: FormData, extra: RoleDraft | null, company: Company, drop: DraftField[] = []) {
  const r = readRole(form);
  const base = { ...emptyDraft(), ...r } as unknown as RoleDraft;
  const d = extra ? overlay(base, extra) : base;
  for (const f of drop) (d as unknown as Record<string, unknown>)[f] = Array.isArray(d[f]) ? [] : null; // cleared this turn
  const role = {
    ...r,
    ...d,
    title: d.title || r.title,
    employment: d.employment ?? r.employment,
    work_mode: d.work_mode ?? r.work_mode,
    salary_period: d.salary_period ?? r.salary_period,
    openings: d.openings ?? r.openings,
    min_experience: d.min_experience ?? r.min_experience,
    city: d.city ?? r.city ?? company.city,
    screening: [],
  } as unknown as Role;
  if (!role.title) return null;
  const post = await generateJobPost(role, company);
  return { description: post.description, by: post.written_by === "claude" ? ("claude" as const) : ("rules" as const) };
}

/**
 * One turn of the New job assistant. It reads what the owner wrote, fills or changes only the fields
 * that message is about, asks about anything important that is still missing, and writes the job
 * description. "Write the description" on its own writes it from the fields already in the form.
 */
export async function assistantTurn(
  message: string,
  form: FormData,
  touchedList: string[],
  answers: { field: string; question: string; answer: string }[],
  skip: string[],
  rewriteDescription: boolean,
): Promise<AssistantReply> {
  const { company } = await requireEmployer();
  const text = String(message ?? "").slice(0, 8000).trim();
  const touched = new Set(touchedList);
  const valid = (f: string): f is DraftField => (DRAFT_FIELDS as readonly string[]).includes(f);
  const skipped = skip.filter(valid);
  const answered = answers.filter((a) => valid(a.field) && a.answer.trim()) as { field: DraftField; question: string; answer: string }[];
  const current = formDraft(form, touched);

  // Only asked for the description: write it from the form as it is.
  if (WANTS_DESCRIPTION.test(text) && !answered.length && text.length < 140) {
    const out = await describe(form, null, company);
    if (!out) return { draft: null, questions: [], suggested: [], clear: [], description: null, by: "rules", note: "Add a job title first (or describe the job to me), then I can write the description." };
    return { draft: null, questions: [], suggested: [], clear: [], description: out.description, by: out.by, note: "Done. The job description is in step 6 below. Change anything you like there, or ask me to change it." };
  }

  // Read the message: Claude when connected, otherwise the built-in reader.
  const qa = answered.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n");
  const known = Object.entries(current)
    .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");
  const prompt = `${text}${qa ? `\n\nAnswers to your questions:\n${qa}` : ""}${known ? `\n\nAlready in the form (keep unless the message changes it):\n${known}` : ""}`;
  const ai = text || qa ? await draftRoleWithAI(prompt, company, skipped) : null;
  let change: RoleDraft;
  let by: "claude" | "rules" = "rules";
  if (ai) {
    change = ai.draft;
    by = "claude";
  } else {
    change = text ? readJobText(text) : emptyDraft();
    // A short change ("make it remote") is not a job title.
    if (current.title && !TITLE_CUE.test(text)) {
      change.title = null;
      if (change.openings === 1 && !COUNT_CUE.test(text)) change.openings = null;
    }
    change = applyAnswers(change, answered);
  }
  const merged = overlay(current, change);
  const suggested: DraftField[] = [];
  // A different job now ("website designer" → "graphic designer"): if the skills were only the
  // assistant's suggestions for the old title, swap them for the new job's. Skills the owner typed stay.
  const titleChanged = !!change.title && !!current.title && change.title.toLowerCase() !== current.title.toLowerCase();
  if (titleChanged && !change.must_have.length) {
    const old = suggestSkills(current.title);
    const wasSuggested = !current.must_have.length || (old.length > 0 && current.must_have.join("|").toLowerCase() === old.join("|").toLowerCase());
    if (wasSuggested) merged.must_have = [];
  }
  const clear: DraftField[] = [];
  if (!merged.must_have.length && merged.title) {
    change.must_have = suggestSkills(merged.title);
    merged.must_have = change.must_have;
    if (change.must_have.length) suggested.push("must_have");
    else if (current.must_have.length) clear.push("must_have"); // nothing fits the new job: empty it and ask
  }
  const questions = missingQuestions(merged).filter((q) => !skipped.includes(q.field));
  const changedCount = Object.values(change).filter((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length)).length;

  let description: string | null = null;
  if (changedCount && merged.title && (rewriteDescription || WANTS_DESCRIPTION.test(text))) description = (await describe(form, change, company, clear))?.description ?? null;

  const note = !changedCount
    ? "I couldn't find job details in that. Try something like \"We need 2 web developers in London, $35k a year\" or \"make it remote\"."
    : `${touched.size ? "Updated" : "Filled"} ${changedCount} field${changedCount === 1 ? "" : "s"}${description ? " and wrote the job description (step 6)" : ""}.${questions.length ? " A few things are still missing:" : " Everything important is filled. Check the form and press \"Create job, post & poster\"."}`;
  return { draft: changedCount ? change : null, questions, suggested, clear, description, by, note };
}
