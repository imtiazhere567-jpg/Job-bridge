import type { Applicant, Role } from "./types";

export interface PrepQuestion {
  q: string;
  /** What a good answer sounds like, so the owner knows what to listen for. */
  listen: string;
}

const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const clean = (s: string) => s.replace(/^[-•*]\s*/, "").trim();

/**
 * Five or six interview questions for this person and this job: their gaps first,
 * then their strongest skill, their last job, their own form answers, the hours and why they want the job.
 * Only job-related questions (never age, family, religion, health and so on).
 */
export function prepQuestions(a: Applicant, role: Role, companyName: string): PrepQuestion[] {
  const out: PrepQuestion[] = [];
  const seen = new Set<string>();
  const STOP = new Set(["about", "what", "with", "your", "tell", "time", "that", "this", "have", "when", "work", "they", "were", "does", "from", "there", "would", "could", "which", "job", "jobs"]);
  const words = (q: string) => new Set(q.toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !STOP.has(w)) ?? []);
  const asked: Set<string>[] = [];
  const add = (q: string, listen: string, max = 6, always = false) => {
    const key = q.toLowerCase().replace(/[^a-z]/g, "").slice(0, 40);
    if (!q || seen.has(key) || out.length >= max) return;
    // Skip a question that covers the same ground as one already on the list.
    const w = words(q);
    if (!always && asked.some((x) => [...w].filter((y) => x.has(y)).length >= 2)) return;
    seen.add(key);
    asked.push(w);
    out.push({ q, listen });
  };
  const crit = a.breakdown?.criteria ?? [];
  const missing = crit.filter((c) => !c.met && c.kind !== "screening");
  const met = crit.filter((c) => c.met && c.kind === "must");

  // 1. Gaps: check what the CV didn't show.
  for (const c of missing.slice(0, 2)) {
    if (c.kind === "language") add(`Can we do part of this conversation in ${c.label.replace(/^Speaks /, "")}? How often have you used it at work?`, "Speaks it comfortably, with real work examples.");
    else if (c.kind === "experience") add(`This job needs ${role.min_experience}+ year${role.min_experience === 1 ? "" : "s"} of experience. Tell me about each job you've done and how long you were there.`, "Clear dates and duties that match this job.");
    else add(`The CV doesn't mention ${lower(c.label)}. Have you done it before? Tell me about a time you did.`, "A real example: what they did, how and what happened.");
  }

  // 2. Their strongest skill for this job.
  if (met[0]) add(`Walk me through a time you used ${lower(met[0].label)} at work. What exactly did you do?`, "Specific steps and results, not general claims.");

  // 3. Their most recent job from the CV.
  const last = a.parsed?.experience?.map(clean).find((e) => e.length > 8);
  if (last) add(`Tell me about your time at "${last.length > 70 ? `${last.slice(0, 70)}…` : last}". What were your main responsibilities, and why are you looking to move?`, "Responsibilities that match this role, and a fair reason for moving on.");

  // 4. Follow up a written answer from the apply form.
  const written = a.answers.find((x) => x.answer && x.answer.length > 25 && !/^(yes|no)$/i.test(x.answer));
  if (written) add(`On the form you answered "${written.question.replace(/\?$/, "")}". Can you tell me more about that?`, "The same story told with more detail; it should match what they wrote.");

  // 5. Why this job (always asked), leaving room for the hours question.
  add(`Why do you want to work as a ${role.title} with ${companyName}?`, "They know what the job involves and have a real reason for wanting it.", 5, true);

  // 6. Earlier suggestions from the screening (rules or AI), if any are left.
  for (const q of a.summary?.questions ?? []) add(q, "A concrete example, honest about what they don't know yet.", 5);

  // 7. Practical fit.
  const hours = [role.hours, role.shift].filter(Boolean).join(", ");
  if (hours) add(`The hours are ${hours}${role.work_mode && role.work_mode !== "On-site" ? ` (${role.work_mode.toLowerCase()})` : ""}. Does that work for you, and when could you start?`, "A clear yes and a realistic start date.");
  add("Tell me about a time something went wrong at work. What did you do?", "Takes ownership, stays calm and explains what they learned.");
  add("How do you handle a very busy day when several things need doing at once?", "A simple way of prioritising, and staying polite under pressure.");
  add("What questions do you have for us?", "Thoughtful questions about the job or the team.");
  return out;
}
