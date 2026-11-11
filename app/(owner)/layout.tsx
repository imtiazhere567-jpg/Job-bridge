import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { runReminders } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await runReminders();
  return <AppShell user={user}>{children}</AppShell>;
}
