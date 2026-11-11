"use server";

import { redirect } from "next/navigation";
import { submitApplication } from "@/lib/apply";

/** Apply form on the full job page. */
export async function apply(slug: string, _: unknown, form: FormData) {
  const res = await submitApplication({ slug }, form);
  if ("error" in res) return res;
  const qs = new URLSearchParams({ ...(res.again ? { again: "1" } : {}), n: res.first });
  redirect(`/jobs/${slug}/thanks?${qs}`);
}

/** Apply form opened from a share link (/apply/<job>) or the website snippet (/embed/apply/<code>). */
export async function applyByCode(code: string, embed: boolean, _: unknown, form: FormData) {
  const res = await submitApplication({ code }, form);
  if ("error" in res) return res;
  const qs = new URLSearchParams({ ...(res.again ? { again: "1" } : {}), n: res.first });
  redirect(`${embed ? "/embed" : ""}/apply/${res.slug}/thanks?${qs}`);
}
