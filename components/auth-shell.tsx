import Link from "next/link";
import { BrandStar, Logo } from "./logo";

/** Sign-in layout: navy bridge panel with the white logo, form on white. */
export function AuthShell({ children, title, text }: { children: React.ReactNode; title: string; text: string }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <section className="bridge-gradient relative hidden overflow-clip p-12 text-white lg:flex lg:flex-col">
        <Link href="/login"><Logo tone="dark" size={52} /></Link>
        <div className="relative z-10 mt-auto max-w-md">
          <BrandStar size={26} className="mb-5 text-[#5db6f7]" />
          <h1 className="font-display text-[44px] leading-[1.06] font-extrabold">{title}</h1>
          <p className="mt-5 text-[16px] leading-relaxed text-white/75">{text}</p>
        </div>
        {/* The bridge */}
        <svg className="absolute -right-10 bottom-0 opacity-20" width="520" height="300" viewBox="0 0 520 300" aria-hidden="true">
          <path d="M20 300C110 60 410 60 500 300" fill="none" stroke="#5db6f7" strokeWidth="44" />
          <path d="M120 300C180 150 340 150 400 300" fill="none" stroke="#fff" strokeWidth="16" />
        </svg>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Link href="/login" className="mb-8 inline-block lg:hidden"><Logo size={40} /></Link>
          {children}
        </div>
      </section>
    </div>
  );
}
