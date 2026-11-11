import "server-only";
import { uniqueSlug } from "./hiring";
import path from "node:path";
import { db } from "./db";
import { analyzeApplicant } from "./ai";
import { companyForRole, logActivity, send, templates } from "./messages";
import type { Answer, Applicant, Role } from "./types";

const j = (v: unknown) => JSON.stringify(v);
const ALLOWED = [".pdf", ".docx", ".txt"];
// Vercel accepts request bodies up to 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;

/** Read text out of a PDF, Word (.docx) or text CV. */
export async function extractText(buf: Buffer, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();
  try {
    if (ext === ".pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await pdfText(pdf, { mergePages: true });
      return text;
    }
    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      return (await mammoth.extractRawText({ buffer: buf })).value;
    }
    return buf.toString("utf8");
  } catch (e) {
    console.error("[intake] could not read CV", filename, e);
    return "";
  }
}

export function validateCv(file: File | null) {
  if (!file || file.size === 0) return "Please attach your CV.";
  if (!ALLOWED.includes(path.extname(file.name).toLowerCase())) return "CV must be a PDF or Word (.docx) file.";
  if (file.size > MAX_BYTES) return "CV must be smaller than 4 MB.";
  return null;
}

const normPhone = (p: string | null) => (p ? p.replace(/\D/g, "").replace(/^0044/, "0").replace(/^44/, "0").replace(/^7/, "07") : null);

export interface IntakeInput {
  role: Role;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string;
  answers: Answer[];
  file: File | null;
  /** Signed-in job seeker, if any. */
  userId?: number | null;
}

/**
 * Add an application: store the CV, detect duplicates, read + score it and
 * send the instant "application received" message.
 */
export async function intakeApplication(input: IntakeInput): Promise<{ id: number; duplicate: boolean }> {
  const { role } = input;
  // The CV file is kept in the database (cv_data); cv_file holds its extension.
  let cvFile: string | null = null;
  let cvData: Buffer | null = null;
  let cvText = "";
  if (input.file && input.file.size > 0) {
    cvData = Buffer.from(await input.file.arrayBuffer());
    cvFile = path.extname(input.file.name).toLowerCase();
    cvText = await extractText(cvData, input.file.name);
  }

  const phone = normPhone(input.phone);
  const email = input.email?.trim().toLowerCase() || null;

  // Duplicate = same email or phone for the same role. Keep one record and refresh it.
  const existing = await db.one<Applicant>(
    "select * from applicants where role_id = $1 and ((email is not null and email = $2) or (phone is not null and phone = $3)) order by id limit 1",
    [role.id, email, phone],
  );

  const analysis = await analyzeApplicant(role, cvText, input.answers);
  const company = await companyForRole(role.id);

  return db.tx(async (t) => {
    if (existing) {
      await t.q(
        `update applicants set duplicate_count = duplicate_count + 1, answers = $2, cv_file = coalesce($3, cv_file), cv_data = coalesce($12, cv_data), cv_name = coalesce($4, cv_name),
         cv_text = case when $5 = '' then cv_text else $5 end, parsed = $6, score = $7, band = $8, breakdown = $9, summary = $10, scored_by = $11, user_id = coalesce(user_id, $13), updated_at = now()
         where id = $1`,
        [existing.id, JSON.stringify(input.answers), cvFile, input.file?.name ?? null, cvText, j(analysis.parsed), analysis.score, analysis.band, j(analysis.breakdown), j(analysis.summary), analysis.scored_by, cvData, input.userId ?? null],
      );
      await logActivity(t, `${existing.name} applied again (duplicate merged)`, role.id, existing.id);
      return { id: existing.id, duplicate: true };
    }
    const row = await t.one<Applicant>(
      `insert into applicants (role_id, name, email, phone, city, source, cv_file, cv_data, cv_name, cv_text, parsed, answers, score, band, breakdown, summary, scored_by, user_id, slug)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning *`,
      [
        role.id,
        input.name.trim(),
        email ?? analysis.parsed.email,
        phone ?? normPhone(analysis.parsed.phone),
        input.city?.trim() || null,
        input.source,
        cvFile,
        cvData,
        input.file?.name ?? null,
        cvText,
        j(analysis.parsed),
        JSON.stringify(input.answers),
        analysis.score,
        analysis.band,
        j(analysis.breakdown),
        j(analysis.summary),
        analysis.scored_by,
        input.userId ?? null,
        await uniqueSlug("applicants", input.name, 0, t),
      ],
    );
    const m = templates.received(row!, role, company);
    await send(t, row!, "received", m.subject, m.body);
    await logActivity(t, `New application from ${row!.name}`, role.id, row!.id);
    return { id: row!.id, duplicate: false };
  });
}

/** Re-read and re-score an applicant (e.g. after the role profile changes). */
export async function rescore(applicantId: number) {
  const a = await db.one<Applicant>("select * from applicants where id = $1", [applicantId]);
  if (!a) return;
  const role = (await db.one<Role>("select * from roles where id = $1", [a.role_id]))!;
  const analysis = await analyzeApplicant(role, a.cv_text ?? "", a.answers);
  await db.q("update applicants set parsed=$2, score=$3, band=$4, breakdown=$5, summary=$6, scored_by=$7, updated_at=now() where id=$1", [
    a.id,
    j(analysis.parsed),
    analysis.score,
    analysis.band,
    j(analysis.breakdown),
    j(analysis.summary),
    analysis.scored_by,
  ]);
}
