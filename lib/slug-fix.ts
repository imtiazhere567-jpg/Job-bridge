import type { Queryable } from "./db";
import { rememberSlug, slugify, uniqueSlug } from "./hiring";

/**
 * Readable web addresses, run at start-up:
 * - every applicant without a slug gets one from their name ("hannah-brooks", then "hannah-brooks-2")
 * - jobs made before lose the company prefix ("jobbridge-video-editor" becomes "video-editor")
 */
export async function fixSlugs(t: Queryable) {
  const people = await t.q<{ id: number; name: string }>("select id, name from applicants where slug is null order by id");
  for (const p of people) await t.q("update applicants set slug = $2 where id = $1", [p.id, await uniqueSlug("applicants", p.name, p.id, t)]);

  const roles = await t.q<{ id: number; title: string; slug: string; company_slug: string }>(
    "select r.id, r.title, r.slug, c.slug as company_slug from roles r join companies c on c.id = r.company_id",
  );
  for (const r of roles) {
    if (!r.slug.startsWith(`${r.company_slug}-`)) continue;
    const clean = slugify(r.title);
    if (r.slug === clean) continue;
    await rememberSlug(r.id, r.slug, t);
    await t.q("update roles set slug = $2 where id = $1", [r.id, await uniqueSlug("roles", r.title, r.id, t)]);
  }
}
