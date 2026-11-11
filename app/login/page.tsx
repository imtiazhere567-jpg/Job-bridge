import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata = { title: "Owner sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <AuthShell title="Your hiring studio." text="Post a job, get four poster designs to choose from, and manage every applicant, interview and WhatsApp message in one place.">
      <div className="eyebrow mb-2">Owner access</div>
      <h2 className="font-display text-[28px] font-extrabold text-lagoon">Sign in</h2>
      <p className="mt-1 mb-6 text-sm text-slate">This dashboard is for the JobBridge team only.</p>
      <LoginForm />
    </AuthShell>
  );
}
