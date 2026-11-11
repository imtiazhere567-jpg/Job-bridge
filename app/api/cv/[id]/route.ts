import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
};

/** CV download for the signed-in owner only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const a = await db.one<{ cv_file: string | null; cv_name: string | null; cv_data: Uint8Array | null; user_id: number | null; owner_id: number }>(
    `select a.cv_file, a.cv_name, a.cv_data, a.user_id, c.owner_id
     from applicants a join roles r on r.id = a.role_id join companies c on c.id = r.company_id where a.id = $1`,
    [Number(id)],
  );
  if (!a) return new Response("Not found", { status: 404 });
  if (!a.cv_data) return new Response("No CV file", { status: 404 });
  const ext = a.cv_file ?? "";
  return new Response(new Uint8Array(a.cv_data), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "content-disposition": `inline; filename="${(a.cv_name ?? `cv${ext}`).replace(/"/g, "")}"`,
    },
  });
}
