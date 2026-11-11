"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarClock, LayoutGrid, LogOut, MessageSquareText, Settings, Users } from "lucide-react";
import { Logo } from "./logo";

type Item = { href: string; label: string; icon: typeof LayoutGrid; badge?: number };

/** Owner navigation: deep navy, like the "JOB" in the logo, with the white logo on top. */
export function Sidebar({ user, counts = {} }: { user: string; counts?: Record<string, number> }) {
  const path = usePathname();
  const nav: Item[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutGrid },
    { href: "/roles", label: "Jobs & posters", icon: Briefcase },
    { href: "/applicants", label: "Applicants", icon: Users, badge: counts.applicants },
    { href: "/interviews", label: "Interviews", icon: CalendarClock, badge: counts.interviews },
    { href: "/messages", label: "WhatsApp & email", icon: MessageSquareText, badge: counts.unread },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  return (
    <aside className="bridge-gradient relative flex w-full flex-col overflow-clip text-white print:hidden lg:sticky lg:top-0 lg:h-screen lg:w-[264px] lg:shrink-0">
      {/* A faint bridge arc behind the menu */}
      <svg className="pointer-events-none absolute -right-24 bottom-24 hidden opacity-[0.07] lg:block" width="380" height="240" viewBox="0 0 380 240" aria-hidden="true">
        <path d="M10 230C80 40 300 40 370 230" fill="none" stroke="#fff" strokeWidth="34" strokeLinecap="round" />
      </svg>
      <div className="relative px-5 pt-6 pb-6">
        <Link href="/dashboard" className="block">
          <Logo tone="dark" size={48} tagline={false} />
          <div className="mt-2 text-[9.5px] font-semibold tracking-[0.1em] whitespace-nowrap text-white/65 uppercase">Connecting talent to opportunity</div>
        </Link>
      </div>
      <nav className="relative flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
        {nav.map(({ href, label, icon: Icon, badge }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold whitespace-nowrap ${active ? "bg-white text-lagoon shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon size={17} strokeWidth={2} className={active ? "text-coral" : ""} />
              <span className="flex-1">{label}</span>
              {!!badge && <span className={`chip px-2 py-0 text-[11px] ${active ? "bg-coral text-white" : "bg-[#5db6f7] text-deep"}`}>{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="relative mt-auto hidden px-4 pb-5 lg:block">
        <div className="flex items-center justify-between border-t border-white/15 pt-4">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold">{user}</div>
            <div className="text-[12px] text-white/60">Owner · full access</div>
          </div>
          <form action="/logout" method="post">
            <button className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
