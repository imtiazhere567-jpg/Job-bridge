import { mix } from "@/lib/poster";

/** Executive office chair, 3/4 front view, in any colour. Drawn at width w (height is 1.5 × w). */
export function Chair({ w, color, id = "c" }: { w: number; color: string; id?: string }) {
  const cd = mix(color, "#000000", 0.35);
  const cdd = mix(color, "#000000", 0.6);
  const cl = mix(color, "#FFFFFF", 0.2);
  const leg = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <path d={`M200 526 L${x} ${y}`} stroke="#9AA2AC" strokeWidth="18" strokeLinecap="round" />
      <path d={`M200 522 L${x} ${y - 4}`} stroke="#E9ECEF" strokeWidth="5" strokeLinecap="round" />
      <circle cx={x} cy={y + 12} r="15" fill="#23282E" />
      <circle cx={x} cy={y + 12} r="6" fill="#5A626C" />
    </g>
  );
  return (
    <svg width={w} height={w * 1.5} viewBox="0 0 400 600">
      <defs>
        <linearGradient id={`${id}b`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={cd} />
          <stop offset="0.32" stopColor={cl} />
          <stop offset="0.68" stopColor={color} />
          <stop offset="1" stopColor={cd} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={cl} />
          <stop offset="1" stopColor={cd} />
        </linearGradient>
        <linearGradient id={`${id}m`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8E959E" />
          <stop offset="0.5" stopColor="#F1F3F5" />
          <stop offset="1" stopColor="#9AA1AA" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="588" rx="185" ry="12" fill="#000000" opacity="0.13" />
      {leg(200, 548)}
      {leg(52, 552)}
      {leg(348, 552)}
      {leg(118, 572)}
      {leg(282, 572)}
      <ellipse cx="200" cy="526" rx="34" ry="12" fill="#8E959E" />
      <rect x="189" y="436" width="22" height="90" fill={`url(#${id}m)`} />
      <rect x="140" y="428" width="120" height="20" rx="8" fill="#23282E" />
      {/* backrest */}
      <rect x="96" y="118" width="208" height="262" rx="64" fill={`url(#${id}b)`} />
      <path d="M110 212 Q200 228 290 212" stroke={cdd} strokeWidth="3" fill="none" opacity="0.55" />
      <path d="M108 292 Q200 308 292 292" stroke={cdd} strokeWidth="3" fill="none" opacity="0.55" />
      <path d="M136 140 L136 362" stroke={cdd} strokeWidth="3" opacity="0.3" />
      <path d="M264 140 L264 362" stroke={cdd} strokeWidth="3" opacity="0.3" />
      <ellipse cx="168" cy="190" rx="26" ry="58" fill="#FFFFFF" opacity="0.13" />
      {/* headrest */}
      <rect x="172" y="108" width="56" height="20" fill={cdd} />
      <rect x="122" y="38" width="156" height="80" rx="34" fill={`url(#${id}b)`} />
      <ellipse cx="170" cy="66" rx="30" ry="14" fill="#FFFFFF" opacity="0.14" />
      {/* seat */}
      <path d="M62 392 Q62 352 112 348 L288 348 Q338 352 338 392 L338 404 Q338 440 288 442 L112 442 Q62 440 62 404 Z" fill={`url(#${id}s)`} />
      <path d="M92 370 Q200 352 308 370" stroke={cl} strokeWidth="4" fill="none" opacity="0.7" />
      {/* armrests */}
      <path d="M92 324 C70 362 80 404 132 424" stroke={`url(#${id}m)`} strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M308 324 C330 362 320 404 268 424" stroke={`url(#${id}m)`} strokeWidth="14" fill="none" strokeLinecap="round" />
      <rect x="44" y="300" width="96" height="28" rx="14" fill={cdd} />
      <rect x="260" y="300" width="96" height="28" rx="14" fill={cdd} />
      <rect x="54" y="303" width="70" height="6" rx="3" fill="#FFFFFF" opacity="0.15" />
      <rect x="270" y="303" width="70" height="6" rx="3" fill="#FFFFFF" opacity="0.15" />
    </svg>
  );
}

/** Megaphone pointing up and to the right, with optional sound waves. Drawn at width w (height is 0.8 × w). */
export function Megaphone({ w, rim, waves = false, id = "m" }: { w: number; rim: string; waves?: boolean; id?: string }) {
  const rimDark = mix(rim, "#000000", 0.25);
  return (
    <svg width={w} height={w * 0.8} viewBox="0 0 700 560">
      <defs>
        <linearGradient id={`${id}s`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#E3E7EB" />
          <stop offset="1" stopColor="#A9B1BA" />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#D9DEE3" />
          <stop offset="1" stopColor="#9EA6B0" />
        </linearGradient>
        <radialGradient id={`${id}i`} cx="0.6" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#B9C0C8" />
        </radialGradient>
      </defs>
      <ellipse cx="330" cy="520" rx="230" ry="16" fill="#000000" opacity="0.12" />
      <g transform="rotate(-24 330 290)">
        <rect x="178" y="320" width="54" height="128" rx="20" fill={`url(#${id}s)`} transform="rotate(14 205 384)" />
        <rect x="180" y="400" width="54" height="30" rx="10" fill={rim} transform="rotate(14 205 384)" />
        <rect x="80" y="242" width="200" height="104" rx="46" fill={`url(#${id}s)`} />
        <rect x="72" y="250" width="34" height="88" rx="16" fill={rim} />
        <rect x="236" y="234" width="38" height="120" rx="12" fill={rim} />
        <path d="M268 248 L520 128 Q548 294 520 460 L268 340 Z" fill={`url(#${id}h)`} />
        <ellipse cx="522" cy="294" rx="54" ry="168" fill={rim} />
        <ellipse cx="526" cy="294" rx="38" ry="146" fill={`url(#${id}i)`} />
        <ellipse cx="532" cy="294" rx="16" ry="52" fill={rimDark} />
        <ellipse cx="300" cy="262" rx="70" ry="8" fill="#FFFFFF" opacity="0.7" />
        {waves && <path d="M600 200 Q640 294 600 388" stroke={rim} strokeWidth="14" fill="none" strokeLinecap="round" />}
        {waves && <path d="M640 150 Q700 294 640 438" stroke={rim} strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.7" />}
      </g>
    </svg>
  );
}

export const Mail = ({ s, color }: { s: number; color: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24">
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke={color} strokeWidth="2" />
    <path d="M3.5 6.5 L12 13 L20.5 6.5" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export const Globe = ({ s, color }: { s: number; color: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth="2" />
    <path d="M2.5 12 H21.5 M12 2.5 C8 7 8 17 12 21.5 M12 2.5 C16 7 16 17 12 21.5" fill="none" stroke={color} strokeWidth="2" />
  </svg>
);

/** Filled circle with an arrow, like a "go" bullet. */
export const ArrowDot = ({ s, color, arrow }: { s: number; color: string; arrow: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill={color} />
    <path d="M7 12 H16 M12.5 8 L16.5 12 L12.5 16" fill="none" stroke={arrow} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A long sweeping line used as decoration. */
export const Swoosh = ({ w, h, color }: { w: number; h: number; color: string }) => (
  <svg width={w} height={h} viewBox="0 0 400 520">
    <path d="M30 330 C 60 140, 260 40, 420 10" stroke={color} strokeWidth="12" fill="none" strokeLinecap="round" />
    <path d="M300 520 C 250 380, 330 260, 430 220" stroke={color} strokeWidth="12" fill="none" strokeLinecap="round" />
  </svg>
);
