import { SiteFooter, SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

/** The public JobBridge careers site. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-pearl">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
