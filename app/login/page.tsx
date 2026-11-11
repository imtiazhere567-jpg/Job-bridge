import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Submit } from "@/components/client";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./form";
import { exploreDemo } from "./actions";

export const metadata = { title: "Owner sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");
  const demo = process.env.DEMO_MODE !== "off";
  return (
    <AuthShell title="Your hiring studio." text="Post a job, get four poster designs to choose from, and manage every applicant, interview and WhatsApp message in one place.">
      <div className="eyebrow mb-2">Owner access</div>
      <h2 className="font-display text-[28px] font-extrabold text-lagoon">Sign in</h2>
      <p className="mt-1 mb-6 text-sm text-slate">This dashboard is for the JobBridge team only.</p>
      <LoginForm />
      {demo && (
        <div className="mt-8 border-t border-shell pt-6">
          <p className="mb-3 text-sm text-slate">Viewing the portfolio demo? Open it without a password. Demo data resets every night.</p>
          <form action={exploreDemo}>
            <Submit className="btn btn-coral w-full py-3" pendingText="Opening the demo…">Open the demo dashboard <ArrowRight size={16} /></Submit>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
