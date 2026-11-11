import { ApplyThanks } from "@/components/apply-panel";
import { AutoHeight } from "@/components/auto-height";
import { jobByCode } from "@/lib/jobs";

export const metadata = { title: "Application received" };

export default async function EmbedThanks({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ again?: string; n?: string }> }) {
  const { code } = await params;
  const { again, n } = await searchParams;
  const job = await jobByCode(code);
  return (
    <div data-embed-root className="p-1 sm:p-2">
      <style>{"html,body{background:transparent !important}"}</style>
      <ApplyThanks title={job?.role.title ?? "this job"} company={job?.company.name ?? "JobBridge"} again={!!again} first={n} />
      <AutoHeight code={code} />
    </div>
  );
}
