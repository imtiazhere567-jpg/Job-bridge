import "server-only";
import { db } from "./db";

export interface Back {
  href: string;
  label: string;
}

/**
 * The back link at the top of a page, pointing to where the owner came from.
 * Links add `?from=…` (e.g. "interviews", "applicant:hannah-brooks"); without it the page's usual parent is used.
 */
export async function backLink(from: string | undefined | null, fallback: Back, companyId: number): Promise<Back> {
  const f = String(from ?? "");
  const [kind, slug] = f.split(":");
  switch (kind) {
    case "dashboard":
      return { href: "/dashboard", label: "Overview" };
    case "applicants":
      return { href: "/applicants", label: "Applicants" };
    case "interviews":
      return { href: "/interviews", label: "Interviews" };
    case "roles":
      return { href: "/roles", label: "All jobs" };
    case "messages":
      return { href: slug ? `/messages?a=${encodeURIComponent(slug)}` : "/messages", label: "WhatsApp & email" };
    case "applicant": {
      const a = slug ? await db.one<{ name: string }>("select a.name from applicants a join roles r on r.id = a.role_id where a.slug = $1 and r.company_id = $2", [slug, companyId]) : null;
      return a ? { href: `/applicants/${slug}`, label: `Back to ${a.name}` } : fallback;
    }
    case "role":
    case "role-applicants": {
      const r = slug ? await db.one<{ title: string }>("select title from roles where slug = $1 and company_id = $2", [slug, companyId]) : null;
      if (!r) return fallback;
      return kind === "role" ? { href: `/roles/${slug}`, label: r.title } : { href: `/roles/${slug}/applicants`, label: `${r.title} applicants` };
    }
    default:
      return fallback;
  }
}

/** `?from=…` for a link, so the next page's back link returns here. */
export const fromQuery = (from: string) => `from=${encodeURIComponent(from)}`;
