import "server-only";
import { db } from "./db";
import { SOURCES } from "./format";
import { intakeApplication, validateCv } from "./intake";
import { extraFields, fieldMode } from "./form-fields";
import type { Answer, Role } from "./types";

/** Check and save one application from any apply form (job page, share link or website snippet). */
export async function submitApplication(where: { slug?: string; code?: string }, form: FormData): Promise<{ error: string } | { again: boolean; first: string; slug: string }> {
  if (String(form.get("website") ?? "")) return { error: "Something went wrong. Please try again." }; // honeypot
  const role = where.slug
    ? await db.one<Role>("select * from roles where slug = $1 and status = 'open'", [where.slug])
    : await db.one<Role>("select * from roles where (code = $1 or slug = $1) and status = 'open' order by (slug = $1) desc limit 1", [String(where.code ?? "").toLowerCase()]);
  if (!role) {
    const key = String(where.code ?? where.slug ?? "").toLowerCase();
    const draft = await db.one("select 1 from roles where (code = $1 or slug = $1) and status = 'draft'", [key]);
    return { error: draft ? "This is a preview. Applications can be sent once the job is published." : "This job is no longer open." };
  }

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  if (name.length < 3) return { error: "Please enter your full name." };
  if (!phone) return { error: "Please enter your phone number so we can reach you on WhatsApp." };
  const mode = (k: Parameters<typeof fieldMode>[1]) => fieldMode(role.form_fields, k);
  if (!email && mode("email") === "required") return { error: "Please enter your email address." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email address doesn't look right." };
  const city = mode("city") === "off" ? "" : String(form.get("city") ?? "").trim();
  if (!city && mode("city") === "required") return { error: "Please enter your city or area." };
  const raw = form.get("cv") as File | null;
  const file = raw && raw.size > 0 ? raw : null;
  if (file || mode("cv") === "required") {
    const cvError = validateCv(file);
    if (cvError) return { error: cvError };
  }
  if (form.get("consent") !== "on") return { error: "Please agree to let the company store your application." };

  const answers: Answer[] = role.screening.map((q) => ({ id: q.id, question: q.question, answer: String(form.get(q.id) ?? "").trim() }));
  const missing = role.screening.find((q, i) => q.type === "yesno" && !answers[i].answer);
  if (missing) return { error: `Please answer: "${missing.question}"` };
  // Fields the owner added to this job's form.
  for (const f of extraFields(role.form_fields)) {
    let answer = String(form.get(`f_${f.id}`) ?? "").trim().slice(0, 2000);
    if (f.type === "select" && answer && !f.options?.includes(answer)) answer = "";
    if (!answer && f.mode === "required") return { error: `Please fill in: ${f.label}` };
    if (answer) answers.push({ id: `f_${f.id}`, question: f.label, answer });
  }

  const rawSrc = String(form.get("src") ?? "link");
  const source = rawSrc in SOURCES ? rawSrc : "link";

  const res = await intakeApplication({ role, name, email: email || null, phone, city, source, answers, file });
  return { again: !!res.duplicate, first: name.split(/\s+/)[0].slice(0, 40), slug: role.slug };
}
