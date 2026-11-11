import Link from "next/link";
import { getBusiness } from "@/lib/auth";
import { BrandStar, Logo } from "./logo";

/** Header on public job pages: just the logo. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-shell bg-white/95">
      <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Logo size={52} />
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const b = await getBusiness();
  return (
    <footer className="bridge-gradient text-white">
      <div className="mx-auto grid max-w-[1160px] gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr] sm:px-6">
        <div>
          <Logo tone="dark" size={50} />
          <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-white/70">{b.about ?? b.tagline}</p>
        </div>
        <div className="text-[13.5px] text-white/80">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#5db6f7] uppercase"><BrandStar size={10} /> Contact</div>
          {b.address && <div className="py-1">{b.address}</div>}
          {b.email && <div className="py-1">{b.email}</div>}
          {b.phone && <div className="py-1">{b.phone}</div>}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[12px] text-white/55 sm:px-6">
          <span>Applicants are judged only on skills, experience and availability.</span>
          <Link href="/login" className="hover:text-white">Owner sign in</Link>
        </div>
      </div>
    </footer>
  );
}
