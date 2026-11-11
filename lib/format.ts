/** The business runs on UK time (GMT in winter, BST in summer). */
export const TZ = "Europe/London";
/** Country calling code used to turn local numbers (07…) into international ones (447…). */
export const COUNTRY_CODE = "44";
export const LOCALE = "en-GB";

/** UTC offset of UK time on a given day, e.g. "+00:00" (GMT) or "+01:00" (BST). */
export function tzOffset(day: string) {
  const part = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, timeZoneName: "shortOffset" })
    .formatToParts(new Date(`${day}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? `${m[1]}${m[2].padStart(2, "0")}:${m[3] ?? "00"}` : "+00:00";
}
/** A wall-clock time on a day in UK time, as a real instant. */
export const zoned = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00${tzOffset(day)}`);

export const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });

export const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });

export const fmtDay = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

/** YYYY-MM-DD of a date in UK time. */
export const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

export function ago(d: Date | string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const SOURCES: Record<string, string> = {
  website: "Company website",
  board: "Careers site",
  poster: "Poster QR code",
  link: "Apply link",
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  indeed: "Indeed / Reed / Totaljobs",
  email: "Email forward",
  manual: "Added by company",
};

export const BAND_LABEL = { strong: "Strong fit", maybe: "Maybe", nofit: "Not a fit" } as const;

export const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  invited: "Invited to book",
  booked: "Interview booked",
  interviewed: "Interviewed",
  no_show: "No-show",
  rejected: "Not selected",
  hired: "Hired",
};

/** Name for a greeting: "Dr. Sana Javed" → "Dr. Sana", "Sara Malik" → "Sara". */
export function greetName(name: string) {
  const [a, b] = name.trim().split(/\s+/);
  return /^(dr|mr|mrs|ms|miss|prof)\.?$/i.test(a) && b ? `${a} ${b}` : a;
}

/**
 * WhatsApp click-to-chat link for a number as applicants type it
 * ("07700 900123", "+44 7700 900123", "447700…"). Opens WhatsApp with that person.
 */
export function waLink(phone: string | null | undefined, text?: string) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `${COUNTRY_CODE}${d.slice(1)}`;
  if (d.length < 10) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
