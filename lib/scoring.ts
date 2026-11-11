import type { Answer, Band, Breakdown, Criterion, ParsedCv, Role, Summary } from "./types";

/**
 * Fair-hiring scoring.
 * Only job-related evidence counts: must-haves, experience, languages,
 * nice-to-haves and screening answers. Personal details (age, gender,
 * religion, ethnicity, marital status, photos) are never read or weighted.
 * The score is a suggestion; the owner makes every decision.
 */

export const WEIGHTS = { must: 50, experience: 20, nice: 15, screening: 15 };

export function bandFor(score: number): Band {
  if (score >= 72) return "strong";
  if (score >= 48) return "maybe";
  return "nofit";
}

/** Combine per-criterion results into the 0–100 score. Same maths for Claude and the rules engine. */
export function scoreFromCriteria(criteria: Criterion[], years: number, role: Role) {
  const ratio = (kind: Criterion["kind"]) => {
    const list = criteria.filter((c) => c.kind === kind);
    return list.length ? list.filter((c) => c.met).length / list.length : 1;
  };
  const musts = criteria.filter((c) => c.kind === "must" || c.kind === "language");
  const mustRatio = musts.length ? musts.filter((c) => c.met).length / musts.length : 1;
  const expRatio = role.min_experience > 0 ? Math.min(1, years / role.min_experience) : 1;

  const breakdown: Breakdown = {
    must: Math.round(mustRatio * WEIGHTS.must),
    experience: Math.round(expRatio * WEIGHTS.experience),
    nice: Math.round(ratio("nice") * WEIGHTS.nice),
    screening: Math.round(ratio("screening") * WEIGHTS.screening),
    criteria,
  };
  let score = breakdown.must + breakdown.experience + breakdown.nice + breakdown.screening;
  // Missing more than half of the must-haves can never be a strong fit.
  if (mustRatio < 0.5) score = Math.min(score, 45);
  return { score, band: bandFor(score), breakdown };
}

// ---------- Rules engine (used when no Claude API key is set) ----------

const STOP = new Set([
  "and", "or", "the", "a", "an", "of", "with", "in", "at", "to", "for", "on", "basic", "good", "strong",
  "experience", "experienced", "skills", "skill", "knowledge", "ability", "years", "year", "work", "working",
]);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));

const stem = (w: string) => (w.length > 5 ? w.slice(0, -1) : w);

/** Lines about what someone wants ("looking for a front desk job") are not evidence. */
const ASPIRATION = /(looking for|seeking|objective|aspir|would like|want to)/i;

/**
 * A requirement is found when one CV line holds most of its meaningful words.
 * "Front desk or reception experience" is checked as two alternatives.
 * Returns that line as evidence.
 */
function findInText(requirement: string, text: string): string | null {
  const alternatives = requirement
    .split(/\s+or\s+|\s*\/\s*/i)
    .map(tokens)
    .filter((a) => a.length);
  if (!alternatives.length) return null;
  for (const line of text.split(/\n+/)) {
    if (!line.trim() || ASPIRATION.test(line)) continue;
    const lower = line.toLowerCase();
    for (const words of alternatives) {
      const hits = words.filter((w) => lower.includes(stem(w)));
      if (hits.length / words.length >= 0.6) return line.trim().slice(0, 140);
    }
  }
  return null;
}

export function parseCvText(text: string): ParsedCv {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? null;
  const phone = text.match(/(?:\+44\s?7\d{3}|\(?07\d{3}\)?)[\s-]?\d{3}[\s-]?\d{3}/)?.[0]?.replace(/[\s()-]/g, "") ?? null;

  // Years: explicit "X years" or the sum of "2019 - 2022" style ranges.
  let years = 0;
  const explicit = [...text.matchAll(/(\d{1,2})(?:\.\d)?\+?\s*(?:years?|yrs?)/gi)].map((m) => parseInt(m[1], 10));
  if (explicit.length) years = Math.max(...explicit);
  const now = new Date().getFullYear();
  let ranged = 0;
  for (const m of text.matchAll(/(20\d{2}|19\d{2})\s*[-–to]+\s*(20\d{2}|present|current|now)/gi)) {
    const end = /\d/.test(m[2]) ? parseInt(m[2], 10) : now;
    ranged += Math.max(0, end - parseInt(m[1], 10));
  }
  years = Math.max(years, ranged);

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const education = lines.filter((l) => /(matric|intermediate|f\.?a|f\.?sc|bachelor|b\.?a|b\.?com|bs|master|m\.?a|diploma|degree|university|college)/i.test(l)).slice(0, 4);
  const experience = lines.filter((l) => /(19|20)\d{2}\s*[-–to]+\s*((19|20)\d{2}|present|current|now)/i.test(l) && !/^(education|matric|intermediate|bachelor|master)/i.test(l)).slice(0, 5);
  const skillLine = lines.find((l) => /^skills?\b/i.test(l));
  const skills = skillLine
    ? skillLine.replace(/^skills?\s*[:\-]?\s*/i, "").split(/[,;•|]/).map((s) => s.trim()).filter(Boolean).slice(0, 12)
    : [];
  return { email, phone, years_experience: years, skills, education, experience };
}

function screeningCriteria(role: Role, answers: Answer[]): Criterion[] {
  return role.screening.map((q) => {
    const a = answers.find((x) => x.id === q.id)?.answer?.trim() ?? "";
    if (q.type === "yesno") {
      const ok = q.ideal ? a.toLowerCase() === q.ideal : a.length > 0;
      return { label: q.question, kind: "screening" as const, met: ok, evidence: a ? `Answered "${a}"` : "No answer" };
    }
    return { label: q.question, kind: "screening" as const, met: a.length >= 15, evidence: a ? `"${a.slice(0, 120)}"` : "No answer" };
  });
}

export function rulesAnalyze(role: Role, cvText: string, answers: Answer[]) {
  const parsed = parseCvText(cvText);
  const criteria: Criterion[] = [];
  for (const m of role.must_have) {
    const ev = findInText(m, cvText);
    criteria.push({ label: m, kind: "must", met: !!ev, evidence: ev ?? "Not found in CV" });
  }
  for (const lang of role.languages) {
    const ev = findInText(lang, cvText);
    criteria.push({ label: `Speaks ${lang}`, kind: "language", met: !!ev, evidence: ev ?? "Not mentioned in CV" });
  }
  if (role.min_experience > 0) {
    const ok = parsed.years_experience >= role.min_experience;
    criteria.push({
      label: `${role.min_experience}+ year${role.min_experience > 1 ? "s" : ""} relevant experience`,
      kind: "experience",
      met: ok,
      evidence: parsed.years_experience ? `About ${parsed.years_experience} year(s) found in CV` : "No dated experience found",
    });
  }
  for (const n of role.nice_to_have) {
    const ev = findInText(n, cvText);
    criteria.push({ label: n, kind: "nice", met: !!ev, evidence: ev ?? "Not found in CV" });
  }
  criteria.push(...screeningCriteria(role, answers));

  const { score, band, breakdown } = scoreFromCriteria(criteria, parsed.years_experience, role);
  return { parsed, score, band, breakdown, summary: summarize(criteria) };
}

export function summarize(criteria: Criterion[]): Summary {
  const met = criteria.filter((c) => c.met && c.kind !== "screening");
  const missing = criteria.filter((c) => !c.met && (c.kind === "must" || c.kind === "language" || c.kind === "experience"));
  const softMissing = criteria.filter((c) => !c.met && c.kind === "nice");
  const list = (cs: Criterion[], n: number) => cs.slice(0, n).map((c) => c.label).join(", ");
  const strengths = met.length ? `Matches the role on: ${list(met, 3)}.` : "The CV shows no clear match with the role requirements.";
  const gaps = missing.length
    ? `Missing or unclear: ${list(missing, 3)}.`
    : softMissing.length
      ? `Meets every must-have; no sign of ${list(softMissing, 2)} (nice-to-have).`
      : "No gaps against the role profile.";
  const probe = (c: Criterion) =>
    c.kind === "language"
      ? `Can we do part of this conversation in ${c.label.replace(/^Speaks /, "")}? How often have you used it at work?`
      : c.kind === "experience"
        ? "Tell me about every job you have done. How long were you there?"
        : `Can you give me a real example of ${c.label.toLowerCase()} from a past job?`;
  const questions = [
    ...missing.slice(0, 2).map(probe),
    ...softMissing.slice(0, 1).map((c) => `Have you ever worked with ${c.label.toLowerCase()}? How quickly do you learn new software?`),
    "Walk me through a normal working day in your last job.",
    "How do you handle a customer who is upset or in a hurry?",
  ].slice(0, 4);
  const ask = missing[0]
    ? missing[0].kind === "language"
      ? `Check how comfortable they are speaking ${missing[0].label.replace(/^Speaks /, "")}.`
      : missing[0].kind === "experience"
        ? "Check how much hands-on experience they really have."
        : `Ask for a real example of ${missing[0].label.toLowerCase()}.`
    : softMissing[0]
      ? `Ask whether they have used ${softMissing[0].label.toLowerCase()}, and how quickly they learn new systems.`
      : "Ask how they handle a very busy day.";
  return { strengths, gaps, ask, questions };
}
