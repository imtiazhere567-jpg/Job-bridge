/* eslint-disable @next/next/no-img-element */

/** The JobBridge icon (two people, the bridge and the arrow). White version for dark backgrounds. */
export function LogoMark({ size = 32, tone = "color" }: { size?: number; tone?: "color" | "white" }) {
  return (
    <img
      src={tone === "white" ? "/brand/jobbridge-mark-white.png" : "/brand/jobbridge-mark.png"}
      alt="JobBridge"
      width={size}
      height={size}
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Full logo: the icon plus the wordmark and tagline as real text, so it stays
 * sharp and readable at every size (the tagline in the image is too small to read).
 */
export function Logo({ size = 44, tone = "light", tagline = true }: { size?: number; tone?: "light" | "dark"; tagline?: boolean }) {
  const dark = tone === "dark";
  return (
    <div className="flex items-center gap-2.5" aria-label="JobBridge: connecting talent to opportunity">
      <LogoMark size={size} tone={dark ? "white" : "color"} />
      <div className="leading-none">
        <div className="font-display font-extrabold tracking-[-0.01em]" style={{ fontSize: size * 0.5 }}>
          <span className={dark ? "text-white" : "text-lagoon"}>JOB</span>
          <span className={dark ? "text-[#5db6f7]" : "text-coral"}>BRIDGE</span>
        </div>
        {tagline && (
          <div className={`mt-1 font-semibold tracking-[0.12em] uppercase ${dark ? "text-white/65" : "text-silver"}`} style={{ fontSize: Math.max(8.5, size * 0.19) }}>
            Connecting talent to opportunity
          </div>
        )}
      </div>
    </div>
  );
}

/** The four-point star from the logo. */
export function BrandStar({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 0c.7 6.6 4.8 10.9 12 12-7.2 1.1-11.3 5.4-12 12-.7-6.6-4.8-10.9-12-12C7.2 10.9 11.3 6.6 12 0z" fill="currentColor" />
    </svg>
  );
}

/** The bridge arc from the logo, used as a divider under page titles. */
export function BridgeArc({ className = "" }: { className?: string }) {
  return (
    <svg width="92" height="16" viewBox="0 0 92 16" className={className} aria-hidden="true">
      <path d="M2 14C22 2 70 2 90 14" fill="none" stroke="#047CD3" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 0c.3 2.6 1.9 4.3 4.6 4.6-2.7.4-4.3 2-4.6 4.6-.3-2.6-1.9-4.2-4.6-4.6C44.1 4.3 45.7 2.6 46 0z" fill="#063B67" />
    </svg>
  );
}
