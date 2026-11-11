import "server-only";
import { addEdit, applyText, mergeEdits, type TextEdit } from "@/components/poster-editor/text-sync";
import { db } from "./db";
import { rememberSlug, uniqueSlug } from "./hiring";
import { placeText, salaryText } from "./jobpost";
import { baseCopy, brandOf } from "./poster";
import type { Company, Role, ScreeningQuestion } from "./types";

const TEXT_FIELDS = ["description", "post_facebook", "post_instagram", "post_whatsapp", "post_linkedin", "poster_headline", "poster_tagline"] as const;

/** Money amounts in a piece of text: "$28k – $32,000" → [28000, 32000]. */
function amounts(text: string) {
  const out: number[] = [];
  for (const m of text.matchAll(/[$£]\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b)?|(\d[\d,]*(?:\.\d+)?)\s*k\b/gi)) {
    const n = Number((m[1] ?? m[3]).replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(Math.round(m[2] || m[3] ? n * 1000 : n));
  }
  return out;
}

/** Did the old text show this job's salary? */
function showsSalary(role: Role, text: string) {
  if (!role.salary_min && !role.salary_max) return false;
  if ([salaryText(role), salaryText(role, true)].some((f) => text.includes(f))) return true;
  const nums = amounts(text);
  return nums.length > 0 && nums.every((n) => n === role.salary_min || n === role.salary_max);
}

/**
 * A text change made on a poster, saved back into the job: the salary, title and place
 * fields, the job description, the social captions, the poster lines and the screening questions.
 * Returns extra "from → to" pairs (e.g. the long salary form) and the new poster text.
 */
export async function syncPosterText(role: Role, company: Company, from: string, to: string, edits: TextEdit[]) {
  let pairs = addEdit([], from, to);
  const next: Role = { ...role };

  // Salary: read the new amounts and update the job, so every wording of it follows.
  const oldBits = pairs.map((p) => p[0]).concat(from);
  if (oldBits.some((t) => showsSalary(role, t))) {
    const nums = amounts(to);
    if (nums.length) {
      const lo = Math.min(nums[0], nums[1] ?? nums[0]);
      const hi = Math.max(nums[0], nums[1] ?? nums[0]);
      const period = /month|\/\s*mo\b|\bpm\b/i.test(to) ? "month" : /year|\/\s*yr\b|annum|\bp\.?a\.?\b/i.test(to) ? "year" : role.salary_period;
      next.salary_min = lo;
      next.salary_max = nums.length > 1 ? hi : role.salary_min && role.salary_max && role.salary_min !== role.salary_max ? hi : lo;
      next.salary_period = period;
      const extra: TextEdit[] = [
        [salaryText(role), salaryText(next)],
        [salaryText(role, true), salaryText(next, true)],
      ].filter(([a, b]) => a !== b) as TextEdit[];
      pairs = mergeEdits(pairs, extra);
    }
  }

  // Title and place, when the whole value was changed.
  for (const [f, t] of pairs) {
    if (!t) continue;
    if (f === role.title) next.title = t.slice(0, 120);
    if (role.location && f === role.location) next.location = t.slice(0, 160);
    if (role.city && f === role.city) next.city = t.slice(0, 80);
  }

  // The same words everywhere else the job uses them.
  const texts = Object.fromEntries(TEXT_FIELDS.map((k) => [k, role[k] ? applyText(role[k] as string, pairs) : role[k]]));
  const screening: ScreeningQuestion[] = role.screening.map((q) => ({ ...q, question: applyText(q.question, pairs) }));

  await db.q(
    `update roles set title = $2, location = $3, city = $4, salary_min = $5, salary_max = $6, salary_period = $7,
       description = $8, post_facebook = $9, post_instagram = $10, post_whatsapp = $11, post_linkedin = $12,
       poster_headline = $13, poster_tagline = $14, screening = $15, poster_texts = $16, updated_at = now() where id = $1`,
    [
      role.id, next.title, next.location, next.city, next.salary_min, next.salary_max, next.salary_period,
      texts.description, texts.post_facebook, texts.post_instagram, texts.post_whatsapp, texts.post_linkedin,
      texts.poster_headline, texts.poster_tagline, JSON.stringify(screening), JSON.stringify(mergeEdits(edits, pairs).slice(-300)),
    ],
  );

  if (next.title !== role.title) {
    const slug = await uniqueSlug("roles", next.title, role.id);
    if (slug !== role.slug) {
      await rememberSlug(role.id, role.slug);
      await db.q("update roles set slug = $2 where id = $1", [role.id, slug]);
      next.slug = slug;
    }
  }
  const updated = { ...next, ...texts, screening } as Role;
  const copy = baseCopy(updated, brandOf(company));
  return {
    pairs,
    content: {
      title: updated.title,
      salary: salaryText(updated, true),
      place: updated.work_mode === "Remote" ? "Remote (work from home)" : placeText(updated) || company.city || "",
      tagline: copy.tagline,
      intro: copy.intro,
      points: copy.points,
    },
  };
}
