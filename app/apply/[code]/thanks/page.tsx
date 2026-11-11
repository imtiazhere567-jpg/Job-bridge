import { ApplyThanks } from "@/components/apply-panel";
import { Logo } from "@/components/logo";
import { jobByCode } from "@/lib/jobs";

export const metadata = { title: "Application received" };

export default async function ApplyThanksPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ again?: string; n?: string }> }) {
  const { code } = await params;
  const { again, n } = await searchParams;
  const job = await jobByCode(code);
  return (
    <div className="min-h-screen bg-pearl">
      <header className="border-b border-shell bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-4">
          <Logo size={40} />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <ApplyThanks title={job?.role.title ?? "this job"} company={job?.company.name ?? "JobBridge"} again={!!again} first={n} />
      </main>
    </div>
  );
}
