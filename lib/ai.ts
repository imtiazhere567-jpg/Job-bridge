import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { Answer, Company, Criterion, Role, ScreeningQuestion } from "./types";
import { rulesAnalyze, scoreFromCriteria, parseCvText } from "./scoring";
import { salaryText, templateJobPost } from "./jobpost";
import { DRAFT_FIELDS, type DraftField, type DraftResult } from "./role-draft";

/**
 * Claude integration. Every call has a rules-based fallback so the system
 * works without an API key (or when the API is unreachable).
 */

const MODEL = "claude-opus-5-5";

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY && process.env.AI_MODE !== "off";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

async function ask<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T | null> {
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") return null;
    return res.parsed_output ?? null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error(`[ai] Claude API error ${e.status}: ${e.message}`);
    else console.error("[ai] Claude call failed", e);
    return null;
  }
}

const roleBrief = (role: Role) =>
  [
    `Role: ${role.title}${role.department ? ` (${role.department})` : ""}`,
    `Type: ${role.employment}${role.shift ? `, ${role.shift}` : ""}${role.hours ? `, ${role.hours}` : ""}`,
    role.salary_min || role.salary_max ? `Salary: ${salaryText(role)}` : "",
    `Work type: ${role.work_mode}`,
    role.location && role.work_mode !== "Remote" ? `Location: ${role.location}` : "",
    role.start_date ? `Start date: ${role.start_date}` : "",
    role.languages.length ? `Languages: ${role.languages.join(", ")}` : "",
    `Minimum experience: ${role.min_experience} year(s)`,
    `Must-have: ${role.must_have.join("; ") || "none"}`,
    `Nice-to-have: ${role.nice_to_have.join("; ") || "none"}`,
    `Openings: ${role.openings}`,
    role.duties.length ? `Main duties: ${role.duties.join("; ")}` : "",
    role.notes ? `Owner notes: ${role.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

// ---------------- Job post ----------------

const JobPostSchema = z.object({
  description: z
    .string()
    .describe(
      "Full job description, plain text, in exactly this layout: first line 'We're Hiring: <job title>'; then one line each 'Company: <name>', 'Position: <job title>', 'Job Type: <Full-time/Part-time/Contract/Internship>', 'Work Mode: <On-site/Remote/Hybrid>', and 'Location: <place>' unless remote; a blank line; then the sections 'About the Role' (one short paragraph about the job and the ideal candidate, specific to this role), 'Responsibilities', 'Requirements', 'Nice to Have' (only if there are nice-to-have skills), 'What We Offer' (salary, hours and real benefits; never invent benefits that were not given beyond friendly basics like training and a supportive team), 'How to Apply' (one short paragraph: apply through the short online form and upload a CV, plus a portfolio if the job is creative or technical; about 3 minutes); then one last friendly closing line that fits the job, e.g. 'Join our team and turn creative ideas into impactful videos!'. Each section heading on its own line, bullets start with '- ' (5 to 7 bullets for responsibilities and requirements, specific to the job). No markdown symbols like ** or #.",
    ),
  facebook: z.string().describe("Facebook post, 80-120 words, friendly, ends with {APPLY_LINK}"),
  instagram: z.string().describe("Instagram caption, under 70 words, 4-6 hashtags, mentions link in bio"),
  whatsapp: z.string().describe("WhatsApp group message, under 60 words, plain text with a few line breaks, ends with {APPLY_LINK}"),
  linkedin: z.string().describe("LinkedIn post, professional, 90-140 words, ends with {APPLY_LINK}"),
  poster_headline: z.string().describe("Poster headline, 2-5 words, e.g. \"Join our front desk team\""),
  poster_tagline: z.string().describe("Poster line under the headline, 6-12 words, about why this is a good place to work"),
  screening: z
    .array(
      z.object({
        question: z.string(),
        type: z.enum(["yesno", "text"]),
        ideal: z.enum(["yes", "no"]).nullable().describe("For yesno questions, the answer that fits the role; null for text questions"),
      }),
    )
    .describe("4-5 screening questions based only on job requirements (availability, experience, skills, languages). Never ask about age, gender, religion, ethnicity, marital status or health."),
});

/** Job post, captions, poster lines and screening questions. `style` picks the template wording when Claude is off. */
export async function generateJobPost(role: Role, company: Company, style = 0) {
  if (aiEnabled()) {
    const out = await ask(
      JobPostSchema,
      `You write hiring content for ${company.name}${company.industry ? `, a ${company.industry.toLowerCase()} business` : ""} in ${company.city ?? company.address ?? "the United Kingdom"}.${company.about ? ` About them: ${company.about}` : ""} Brand tone: ${company.tone ?? "warm and professional"}. Write in clear, natural British English (UK spelling; salaries in dollars, $) for job seekers in the UK. Never mention age, gender, religion, ethnicity, marital status or appearance requirements. Use the literal placeholder {APPLY_LINK} where the apply link goes.`,
      `Write the job description, social posts and screening questions for this role:\n\n${roleBrief(role)}`,
    );
    if (out) {
      const screening: ScreeningQuestion[] = out.screening.map((q, i) => ({
        id: `q${i + 1}`,
        question: q.question,
        type: q.type,
        ...(q.type === "yesno" && q.ideal ? { ideal: q.ideal } : {}),
      }));
      return { ...out, screening, written_by: "claude" };
    }
  }
  return { ...templateJobPost(role, company, style), written_by: "template" };
}

// ---------------- Applicant analysis ----------------

const AnalysisSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  years_experience: z.number().describe("Years of relevant work experience, decimals allowed"),
  skills: z.array(z.string()).describe("Up to 10 job-relevant skills found in the CV"),
  education: z.array(z.string()).describe("Up to 3 education lines"),
  experience: z.array(z.string()).describe("Up to 5 lines like 'Receptionist, Smile Care Clinic (2021-2024)'"),
  criteria: z
    .array(
      z.object({
        label: z.string().describe("Copy the requirement text exactly as given"),
        kind: z.enum(["must", "nice", "experience", "language", "screening"]),
        met: z.boolean(),
        evidence: z.string().describe("Short quote or fact from the CV/answers, or 'Not found in CV'"),
      }),
    )
    .describe("One entry per requirement listed in the request, in the same order"),
  strengths: z.string().describe("One sentence"),
  gaps: z.string().describe("One sentence"),
  ask: z.string().describe("One sentence: the most useful thing to ask in the interview"),
  questions: z.array(z.string()).describe("3-4 interview questions that probe the gaps"),
});

export async function analyzeApplicant(role: Role, cvText: string, answers: Answer[]) {
  if (aiEnabled() && cvText.trim().length > 40) {
    const requirements = [
      ...role.must_have.map((m) => `[must] ${m}`),
      ...role.languages.map((l) => `[language] Speaks ${l}`),
      ...(role.min_experience > 0 ? [`[experience] ${role.min_experience}+ year${role.min_experience > 1 ? "s" : ""} relevant experience`] : []),
      ...role.nice_to_have.map((n) => `[nice] ${n}`),
      ...role.screening.map((q) => `[screening] ${q.question}${q.ideal ? ` (fits the role if answer is "${q.ideal}")` : ""}`),
    ];
    const answerText = answers.map((a) => `Q: ${a.question}\nA: ${a.answer || "(no answer)"}`).join("\n\n");
    const out = await ask(
      AnalysisSchema,
      "You screen job applicants for a small business. Judge ONLY job-related evidence: skills, experience, languages, availability and answers to job questions. Ignore and never mention age, gender, religion, ethnicity, marital status, photos, name or any other personal characteristic. Be fair and literal: a requirement is met only if the CV or answers show it. You do not make hiring decisions; you give the owner evidence.",
      `ROLE PROFILE\n${roleBrief(role)}\n\nREQUIREMENTS TO CHECK (one criterion each, same order)\n${requirements.join("\n")}\n\nSCREENING ANSWERS\n${answerText || "(none)"}\n\nCV TEXT\n${cvText.slice(0, 60000)}`,
    );
    if (out) {
      const criteria: Criterion[] = out.criteria.map((c) => ({ ...c, label: c.label.replace(/^\[\w+\]\s*/, "") }));
      const { score, band, breakdown } = scoreFromCriteria(criteria, out.years_experience, role);
      const fallback = parseCvText(cvText);
      return {
        parsed: {
          email: out.email ?? fallback.email,
          phone: out.phone ?? fallback.phone,
          years_experience: out.years_experience,
          skills: out.skills,
          education: out.education,
          experience: out.experience,
        },
        score,
        band,
        breakdown,
        summary: { strengths: out.strengths, gaps: out.gaps, ask: out.ask, questions: out.questions },
        scored_by: "claude",
      };
    }
  }
  return { ...rulesAnalyze(role, cvText, answers), scored_by: "rules" };
}

// ---------------- New job from a plain description ----------------

const DraftSchema = z.object({
  title: z.string().nullable().describe("Job title, e.g. 'Customer Support Officer'"),
  department: z.string().nullable(),
  employment: z.enum(["Full-time", "Part-time", "Contract", "Internship"]).nullable(),
  work_mode: z.enum(["On-site", "Remote", "Hybrid"]).nullable(),
  shift: z.string().nullable().describe("e.g. 'Morning shift'"),
  hours: z.string().nullable().describe("e.g. '9:00 am – 5:00 pm, Mon–Sat'"),
  salary_min: z.number().nullable().describe("Dollars ($), for the period in salary_period"),
  salary_max: z.number().nullable().describe("Dollars ($), for the period in salary_period"),
  salary_period: z.enum(["year", "month"]).nullable().describe("Whether the salary is per year (annual) or per month"),
  location: z.string().nullable().describe("Area / address"),
  city: z.string().nullable(),
  openings: z.number().nullable().describe("How many people are needed"),
  start_date: z.string().nullable().describe("YYYY-MM-DD"),
  duties: z.array(z.string()).describe("Main duties, short lines"),
  must_have: z.array(z.string()).describe("Must-have skills as short phrases people write in CVs, e.g. 'Customer service'"),
  nice_to_have: z.array(z.string()),
  languages: z.array(z.string()),
  min_experience: z.number().nullable().describe("Minimum years of experience; 0 if freshers are welcome"),
  notes: z.string().nullable().describe("Anything else useful for the job post writer"),
  questions: z
    .array(z.object({ field: z.enum(DRAFT_FIELDS), question: z.string() }))
    .describe("Short, friendly questions about important details the owner did not give. One per missing field."),
});

/** Claude reads the owner's description (and answers so far) and fills the New job form. Null when unavailable. */
export async function draftRoleWithAI(text: string, company: Company, skip: DraftField[]): Promise<DraftResult | null> {
  if (!aiEnabled()) return null;
  const today = new Date().toISOString().slice(0, 10);
  const out = await ask(
    DraftSchema,
    `You help the owner of ${company.name} (${company.city ?? "United Kingdom"}) post a job in the UK. Read their description and fill the job form. Salaries are in dollars ($), per year or per month; "28k" means $28,000. Use only what they said or clearly implied; leave a field null or empty instead of guessing (never invent a salary or a number of people). Today is ${today}. Write skills as short phrases. Then ask about important details still missing: job title, must-have skills, salary (per year or per month), number of people, full or part time, on-site/remote/hybrid, location (unless remote), working hours, years of experience. Ask in simple English, one question per missing field, at most 6. Never ask about age, gender, religion, ethnicity, marital status or appearance. Do not ask about these fields, the owner chose to skip them: ${skip.join(", ") || "none"}.`,
    text,
  );
  if (!out) return null;
  const { questions, ...draft } = out;
  return { draft: { ...draft, salary_min: draft.salary_min && Math.round(draft.salary_min), salary_max: draft.salary_max && Math.round(draft.salary_max) }, questions: questions.filter((q) => !skip.includes(q.field)), by: "claude" };
}
