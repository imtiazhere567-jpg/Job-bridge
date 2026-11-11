import { notFound } from "next/navigation";
import { ApplyPanel } from "@/components/apply-panel";
import { AutoHeight } from "@/components/auto-height";
import { LogoMark } from "@/components/logo";
import { currentUser } from "@/lib/auth";
import { jobByCode } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Apply" };

/** Form-only page for the website snippet (inside an iframe): no header or footer. */
export default async function EmbedApply({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const job = await jobByCode(code);
  if (!job) notFound();
  // A draft is only visible to the signed-in owner, as a preview.
  const preview = job.role.status === "draft";
  if (preview && !(await currentUser())) notFound();
  return (
    <div data-embed-root className="p-1 sm:p-2">
      <style>{"html,body{background:transparent !important}"}</style>
      {preview && <div className="mb-3 rounded-xl bg-amber-soft px-4 py-2.5 text-center text-sm font-bold text-amber">Draft preview: this is how the form will look on your website. It goes live when you publish the job.</div>}
      <ApplyPanel role={job.role} company={job.company} src="website" embed preview={preview} />
      <div className="mt-3 flex items-center justify-center gap-2 text-[11.5px] text-slate"><LogoMark size={16} /> Applications by JobBridge</div>
      <AutoHeight code={code} />
    </div>
  );
}
