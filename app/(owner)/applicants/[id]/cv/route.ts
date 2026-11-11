import { currentUser, getBusiness } from "@/lib/auth";
import { db } from "@/lib/db";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A CV as a clean, printable page in the brand style (for Word files and CVs we only have as text). */
function page(name: string, body: string, download?: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} · CV</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#EEF3F8;font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0C1B2E}
  .bar{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:#063B67;color:#fff}
  .bar b{font-weight:800;letter-spacing:.02em} .bar span{opacity:.75;font-size:13px}
  .bar a,.bar button{font:600 13px system-ui;color:#063B67;background:#fff;border:0;border-radius:999px;padding:8px 14px;text-decoration:none;cursor:pointer;margin-left:6px}
  .sheet{max-width:820px;margin:28px auto;background:#fff;border-radius:18px;padding:48px 56px;box-shadow:0 10px 40px rgba(6,59,103,.12)}
  h1{margin:0 0 4px;font-size:28px;color:#063B67} h2{margin:26px 0 8px;padding-bottom:6px;border-bottom:2px solid #E3ECF5;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#047CD3}
  p{margin:4px 0} ul{margin:4px 0 4px 20px;padding:0} li{margin:2px 0} table{border-collapse:collapse} td{padding:4px 8px;vertical-align:top}
  @media print{.bar{display:none} body{background:#fff} .sheet{box-shadow:none;margin:0;padding:0}}
  @media (max-width:640px){.sheet{margin:0;border-radius:0;padding:28px 22px}}
</style></head><body>
<div class="bar"><div><b>CV</b> <span>${esc(name)}</span></div><div>${download ? `<a href="${download}">Download original</a>` : ""}<button onclick="print()">Print</button></div></div>
<div class="sheet">${body}</div></body></html>`;
}

/** Plain CV text to simple HTML: ALL-CAPS lines become headings, "-" lines become bullets. */
function textToHtml(name: string, text: string) {
  const out: string[] = [];
  let list = false;
  const lines = text.replace(/\r/g, "").split("\n");
  const first = lines.findIndex((l) => l.trim());
  const startsWithName = first >= 0 && lines[first].trim().toLowerCase() === name.trim().toLowerCase();
  out.push(`<h1>${esc(name)}</h1>`);
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (startsWithName && i === first) return;
    const bullet = /^[-•*]\s+/.test(l);
    if (list && !bullet) {
      out.push("</ul>");
      list = false;
    }
    if (!l) return;
    if (bullet) {
      if (!list) out.push("<ul>");
      list = true;
      out.push(`<li>${esc(l.replace(/^[-•*]\s+/, ""))}</li>`);
    } else if (l.length < 40 && l === l.toUpperCase() && /[A-Z]/.test(l)) out.push(`<h2>${esc(l)}</h2>`);
    else out.push(`<p>${esc(l)}</p>`);
  });
  if (list) out.push("</ul>");
  return out.join("\n");
}

/**
 * The applicant's CV in a new tab: /applicants/<name>/cv
 * PDF opens as it is; Word and text CVs open as a clean page. ?download=1 gives the original file.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return Response.redirect(new URL("/login", req.url), 302);
  const company = await getBusiness();
  const key = decodeURIComponent((await params).id);
  const a = await db.one<{ name: string; cv_file: string | null; cv_name: string | null; cv_data: Uint8Array | null; cv_text: string | null }>(
    `select a.name, a.cv_file, a.cv_name, a.cv_data, a.cv_text from applicants a join roles r on r.id = a.role_id
     where ${/^\d+$/.test(key) ? "a.id = $1::int" : "a.slug = $1"} and r.company_id = $2`,
    [key, company.id],
  );
  if (!a) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  const ext = a.cv_file ?? "";
  const filename = (a.cv_name ?? `${a.name} CV${ext}`).replace(/["\r\n]/g, "");

  if (a.cv_data && (download || ext === ".pdf" || !TYPES[ext] || ext === ".txt")) {
    return new Response(new Uint8Array(a.cv_data), {
      headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"` },
    });
  }
  if (a.cv_data && ext === ".docx") {
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(a.cv_data) });
      return new Response(page(a.name, value, "?download=1"), { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch {
      /* fall back to the text below */
    }
  }
  if (a.cv_text?.trim()) return new Response(page(a.name, textToHtml(a.name, a.cv_text), a.cv_data ? "?download=1" : undefined), { headers: { "content-type": "text/html; charset=utf-8" } });
  return new Response("No CV for this applicant", { status: 404 });
}
