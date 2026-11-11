/** Poster artwork as SVG strings (used by the poster editor; each becomes a movable image layer). */

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mixHex(a: string, b: string, t: number) {
  const [x, y] = [hex(a), hex(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Executive office chair, 3/4 view. 400 × 600. */
export function chairSvg(color: string) {
  const cd = mixHex(color, "#000000", 0.35);
  const cdd = mixHex(color, "#000000", 0.6);
  const cl = mixHex(color, "#FFFFFF", 0.22);
  const leg = (x: number, y: number) =>
    `<path d="M200 526 L${x} ${y}" stroke="#9AA2AC" stroke-width="18" stroke-linecap="round"/><path d="M200 522 L${x} ${y - 4}" stroke="#E9ECEF" stroke-width="5" stroke-linecap="round"/><circle cx="${x}" cy="${y + 12}" r="15" fill="#23282E"/><circle cx="${x}" cy="${y + 12}" r="6" fill="#5A626C"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
<defs>
<linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${cd}"/><stop offset=".32" stop-color="${cl}"/><stop offset=".68" stop-color="${color}"/><stop offset="1" stop-color="${cd}"/></linearGradient>
<linearGradient id="s" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${cl}"/><stop offset="1" stop-color="${cd}"/></linearGradient>
<linearGradient id="m" x1="0" x2="1"><stop offset="0" stop-color="#8E959E"/><stop offset=".5" stop-color="#F1F3F5"/><stop offset="1" stop-color="#9AA1AA"/></linearGradient>
</defs>
<ellipse cx="200" cy="588" rx="185" ry="12" fill="#000" opacity=".16"/>
${leg(200, 548)}${leg(52, 552)}${leg(348, 552)}${leg(118, 572)}${leg(282, 572)}
<ellipse cx="200" cy="526" rx="34" ry="12" fill="#8E959E"/>
<rect x="189" y="436" width="22" height="90" fill="url(#m)"/>
<rect x="140" y="428" width="120" height="20" rx="8" fill="#23282E"/>
<rect x="96" y="118" width="208" height="262" rx="64" fill="url(#b)"/>
<path d="M110 212 Q200 228 290 212" stroke="${cdd}" stroke-width="3" fill="none" opacity=".55"/>
<path d="M108 292 Q200 308 292 292" stroke="${cdd}" stroke-width="3" fill="none" opacity=".55"/>
<ellipse cx="168" cy="190" rx="26" ry="58" fill="#fff" opacity=".13"/>
<rect x="172" y="108" width="56" height="20" fill="${cdd}"/>
<rect x="122" y="38" width="156" height="80" rx="34" fill="url(#b)"/>
<path d="M62 392 Q62 352 112 348 L288 348 Q338 352 338 392 L338 404 Q338 440 288 442 L112 442 Q62 440 62 404 Z" fill="url(#s)"/>
<path d="M92 324 C70 362 80 404 132 424" stroke="url(#m)" stroke-width="14" fill="none" stroke-linecap="round"/>
<path d="M308 324 C330 362 320 404 268 424" stroke="url(#m)" stroke-width="14" fill="none" stroke-linecap="round"/>
<rect x="44" y="300" width="96" height="28" rx="14" fill="${cdd}"/><rect x="260" y="300" width="96" height="28" rx="14" fill="${cdd}"/>
</svg>`;
}

/** Modern mesh office chair seen from the side, like a product photo. 520 × 640. */
export function meshChairSvg(color: string) {
  const light = mixHex(color, "#FFFFFF", 0.35);
  const dark = mixHex(color, "#000000", 0.35);
  const mesh = `<pattern id="mesh" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${light}"/><circle cx="5" cy="5" r="1.6" fill="${color}" opacity=".55"/></pattern>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="640" viewBox="0 0 520 640">
<defs>${mesh}
<linearGradient id="fr" x1="0" x2="1"><stop offset="0" stop-color="#1B1F24"/><stop offset=".5" stop-color="#3A4048"/><stop offset="1" stop-color="#15181C"/></linearGradient>
<linearGradient id="sh" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<ellipse cx="270" cy="622" rx="220" ry="14" fill="#000" opacity=".25"/>
<path d="M150 40 Q300 0 420 70 L440 330 Q330 360 200 350 Z" fill="url(#mesh)" stroke="${dark}" stroke-width="10"/>
<path d="M165 60 Q300 25 405 85 L415 160 Q300 120 175 140 Z" fill="url(#sh)"/>
<path d="M120 380 Q260 330 470 370 L480 420 Q300 470 110 440 Z" fill="url(#mesh)" stroke="${dark}" stroke-width="10"/>
<path d="M60 330 L210 312 Q232 310 232 330 L232 336 Q230 350 210 352 L80 362 Q56 364 56 344 Z" fill="url(#fr)"/>
<path d="M150 352 L170 440" stroke="url(#fr)" stroke-width="20" stroke-linecap="round"/>
<path d="M330 330 L470 315 Q492 314 492 334 L490 340 Q488 354 468 356 L340 366 Q318 368 318 348 Z" fill="url(#fr)"/>
<path d="M440 356 L420 430" stroke="url(#fr)" stroke-width="20" stroke-linecap="round"/>
<rect x="270" y="440" width="26" height="110" rx="8" fill="#8E959E"/>
<path d="M283 550 L100 600 M283 550 L470 600 M283 550 L283 610 M283 550 L170 625 M283 550 L400 625" stroke="url(#fr)" stroke-width="16" stroke-linecap="round"/>
<circle cx="100" cy="606" r="13" fill="#111"/><circle cx="470" cy="606" r="13" fill="#111"/><circle cx="283" cy="616" r="13" fill="#111"/><circle cx="170" cy="630" r="12" fill="#111"/><circle cx="400" cy="630" r="12" fill="#111"/>
</svg>`;
}

/** Megaphone pointing up-right. 700 × 560. */
export function megaphoneSvg(rim: string, waves = false) {
  const rimDark = mixHex(rim, "#000000", 0.25);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="560" viewBox="0 0 700 560">
<defs>
<linearGradient id="s" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#E3E7EB"/><stop offset="1" stop-color="#A9B1BA"/></linearGradient>
<linearGradient id="h" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#D9DEE3"/><stop offset="1" stop-color="#9EA6B0"/></linearGradient>
<radialGradient id="i" cx=".6" cy=".5" r=".6"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#B9C0C8"/></radialGradient>
</defs>
<ellipse cx="330" cy="520" rx="230" ry="16" fill="#000" opacity=".14"/>
<g transform="rotate(-24 330 290)">
<rect x="178" y="320" width="54" height="128" rx="20" fill="url(#s)" transform="rotate(14 205 384)"/>
<rect x="180" y="400" width="54" height="30" rx="10" fill="${rim}" transform="rotate(14 205 384)"/>
<rect x="80" y="242" width="200" height="104" rx="46" fill="url(#s)"/>
<rect x="72" y="250" width="34" height="88" rx="16" fill="${rim}"/>
<rect x="236" y="234" width="38" height="120" rx="12" fill="${rim}"/>
<path d="M268 248 L520 128 Q548 294 520 460 L268 340 Z" fill="url(#h)"/>
<ellipse cx="522" cy="294" rx="54" ry="168" fill="${rim}"/>
<ellipse cx="526" cy="294" rx="38" ry="146" fill="url(#i)"/>
<ellipse cx="532" cy="294" rx="16" ry="52" fill="${rimDark}"/>
<ellipse cx="300" cy="262" rx="70" ry="8" fill="#fff" opacity=".7"/>
${waves ? `<path d="M600 200 Q640 294 600 388" stroke="${rim}" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M640 150 Q700 294 640 438" stroke="${rim}" stroke-width="14" fill="none" stroke-linecap="round" opacity=".7"/>` : ""}
</g>
</svg>`;
}

/** Glossy "like" bubble (heart or thumbs-up) like social-media reactions. 220 × 200. */
export function bubbleSvg(color: string, kind: "heart" | "like" | "star" = "heart") {
  const light = mixHex(color, "#FFFFFF", 0.3);
  const dark = mixHex(color, "#000000", 0.25);
  const icon =
    kind === "heart"
      ? `<path d="M110 132 C60 100 52 70 70 54 C86 40 104 48 110 62 C116 48 134 40 150 54 C168 70 160 100 110 132 Z" fill="#F4F8FF"/>`
      : kind === "like"
        ? `<path d="M74 92 h20 v52 h-20 z M100 92 l22 -36 c8 -12 22 -6 20 8 l-4 22 h30 c10 0 16 8 14 18 l-8 34 c-2 8 -8 12 -16 12 h-58 z" fill="#F4F8FF"/>`
        : `<path d="M110 40 l18 40 44 4 -34 28 10 42 -38 -22 -38 22 10 -42 -34 -28 44 -4 z" fill="#F4F8FF"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="200" viewBox="0 0 220 200">
<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
<path d="M30 20 h160 q20 0 20 20 v100 q0 20 -20 20 h-50 l-30 30 l-10 -30 h-70 q-20 0 -20 -20 v-100 q0 -20 20 -20 z" fill="url(#g)"/>
<path d="M40 28 h140 q12 0 12 12 v20 q-80 -14 -164 10 v-30 q0 -12 12 -12 z" fill="#fff" opacity=".25"/>
${icon}
</svg>`;
}

const icon = (body: string, color: string, size = 48) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Line icons for the editor's Elements panel and poster details. */
export const ICONS: Record<string, { label: string; body: string }> = {
  pin: { label: "Location", body: `<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>` },
  money: { label: "Salary", body: `<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>` },
  clock: { label: "Time", body: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>` },
  mail: { label: "Email", body: `<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 6.5 12 13l8.5-6.5"/>` },
  phone: { label: "Phone", body: `<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>` },
  globe: { label: "Website", body: `<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c-4 4.5-4 14.5 0 19M12 2.5c4 4.5 4 14.5 0 19"/>` },
  check: { label: "Check", body: `<circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.5l3 3 6-6.5"/>` },
  star: { label: "Star", body: `<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z"/>` },
  briefcase: { label: "Job", body: `<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>` },
  users: { label: "Team", body: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/>` },
  arrow: { label: "Arrow", body: `<circle cx="12" cy="12" r="9.5"/><path d="M8 12h8M13 8.5l3.5 3.5-3.5 3.5"/>` },
  heart: { label: "Heart", body: `<path d="M12 20s-7.5-4.6-9-9.3C1.8 6.8 5 4 8 5.2c1.6.6 2.6 2 4 3.4 1.4-1.4 2.4-2.8 4-3.4 3-1.2 6.2 1.6 5 5.5C19.5 15.4 12 20 12 20z"/>` },
};
export const iconSvg = (name: string, color: string, size = 48) => icon(ICONS[name]?.body ?? ICONS.star.body, color, size);

/** JobBridge four-point star. */
export const starSvg = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><path d="M12 0c.7 6.6 4.8 10.9 12 12-7.2 1.1-11.3 5.4-12 12-.7-6.6-4.8-10.9-12-12C7.2 10.9 11.3 6.6 12 0z" fill="${color}"/></svg>`;
