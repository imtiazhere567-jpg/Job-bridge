export type Band = "strong" | "maybe" | "nofit";

export type Stage =
  | "applied"
  | "shortlisted"
  | "invited"
  | "booked"
  | "interviewed"
  | "no_show"
  | "rejected"
  | "hired";

/** There is one account: the JobBridge owner, with access to everything. */
export type UserKind = "owner";

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  kind: UserKind;
}

/** draft = not public yet, open = live on the careers site, closed = filled or closed by the owner */
export type RoleStatus = "draft" | "open" | "closed";

export interface ScreeningQuestion {
  id: string;
  question: string;
  type: "yesno" | "text";
  /** For yes/no questions: the answer that fits the role. */
  ideal?: "yes" | "no";
}

export interface Company {
  id: number;
  owner_id: number;
  slug: string;
  name: string;
  industry: string | null;
  size: string | null;
  tagline: string | null;
  about: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  sign_as: string | null;
  tone: string | null;
  brand_color: string;
  accent_color: string;
  logo_type: string | null;
  slot_minutes: number;
  interview_location: string | null;
  created_at: string;
}

export interface Role {
  id: number;
  company_id: number;
  slug: string;
  code: string;
  title: string;
  department: string | null;
  employment: string;
  /** On-site, Remote or Hybrid. */
  work_mode: string;
  shift: string | null;
  hours: string | null;
  salary_min: number | null;
  salary_max: number | null;
  /** "year" (annual salary) or "month". */
  salary_period: string;
  location: string | null;
  city: string | null;
  openings: number;
  languages: string[];
  min_experience: number;
  duties: string[];
  must_have: string[];
  nice_to_have: string[];
  start_date: string | null;
  notes: string | null;
  status: RoleStatus;
  review_note: string | null;
  reviewed_at: string | null;
  closed_reason: string | null;
  description: string | null;
  post_facebook: string | null;
  post_instagram: string | null;
  post_whatsapp: string | null;
  post_linkedin: string | null;
  poster_headline: string | null;
  poster_tagline: string | null;
  screening: ScreeningQuestion[];
  /** Which optional fields the apply form shows (see lib/form-fields). */
  form_fields: import("./form-fields").FormFields | null;
  /** Poster text changes ["from","to"], applied to every size and design. */
  poster_texts: [string, string][] | null;
  poster: PosterDesign | null;
  written_by: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Answer {
  id: string;
  question: string;
  answer: string;
}

export interface ParsedCv {
  email: string | null;
  phone: string | null;
  years_experience: number;
  skills: string[];
  education: string[];
  experience: string[];
}

export interface Criterion {
  label: string;
  kind: "must" | "nice" | "experience" | "language" | "screening";
  met: boolean;
  evidence: string;
}

export interface Breakdown {
  must: number;
  experience: number;
  nice: number;
  screening: number;
  criteria: Criterion[];
}

export interface Summary {
  strengths: string;
  gaps: string;
  ask: string;
  questions: string[];
}

export interface Applicant {
  id: number;
  /** Name in the web address, e.g. "hannah-brooks". */
  slug: string;
  role_id: number;
  user_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string;
  cv_file: string | null;
  cv_name: string | null;
  cv_text: string | null;
  cv_data?: Uint8Array | null;
  parsed: ParsedCv | null;
  answers: Answer[];
  score: number | null;
  band: Band | null;
  breakdown: Breakdown | null;
  summary: Summary | null;
  scored_by: string | null;
  stage: Stage;
  duplicate_count: number;
  owner_notes: string | null;
  created_at: string;
}

/** The poster templates the studio offers. */
export type PosterTemplate = "studio" | "stripe" | "bold" | "spotlight";

/** A saved, editable poster: template, text and colours. */
export interface PosterDesign {
  v: 2;
  template: PosterTemplate;
  /** Handwritten line above the big word, e.g. "We Are". */
  kicker: string;
  /** The big word, e.g. "Hiring". */
  headline: string;
  /** Line under the big word, e.g. "Join our team". */
  tagline: string;
  /** Label above the job title, e.g. "Open Position". */
  label: string;
  title: string;
  /** One short sentence about the job. */
  intro: string;
  points: string[];
  cta: string;
  /** Email or contact line under the button. */
  contact: string;
  /** Website or social handle in the footer. */
  footer: string;
  bg: string;
  accent: string;
  text: string;
}
