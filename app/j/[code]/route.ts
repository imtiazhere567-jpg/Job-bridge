import { db } from "@/lib/db";
import { SOURCES } from "@/lib/format";

/** Short share link: /j/<code>?s=<source> → opens /apply/<job name>, keeping the source for reports. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const role = await db.one<{ slug: string }>("select slug from roles where code = $1", [code.toLowerCase()]);
  const url = new URL(req.url);
  if (!role) return Response.redirect(new URL("/", url), 302);
  const s = url.searchParams.get("s") ?? "link";
  return Response.redirect(new URL(`/apply/${role.slug}?src=${s in SOURCES ? s : "link"}`, url), 302);
}
