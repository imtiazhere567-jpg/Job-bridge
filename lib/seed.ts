import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Queryable } from "./db";
import { dayKey, zoned } from "./format";
import { templateJobPost } from "./jobpost";
import { baseUrl, templates } from "./messages";
import { rulesAnalyze } from "./scoring";
import type { Answer, Applicant, Company, PosterDesign, Role } from "./types";

/**
 * Seeds the JobBridge business and its one owner account. In demo mode
 * (default) it also seeds four jobs in different states, applicants with
 * WhatsApp conversations, and a saved poster. Applicants are scored with
 * the rules engine, so seeding needs no API calls.
 */

const j = (v: unknown) => JSON.stringify(v);
const code = () => crypto.randomBytes(6).toString("hex").slice(0, 6);

// ---------- Applicant CVs ----------

type Profile = "strong" | "maybe" | "weak";
interface Person { name: string; city: string; src: string; years: number; profile: Profile; extra?: string }
interface Job { title: string; place: string; duty: string; skills: string[]; extraSkills: string[] }

// Fictional previous employers.
const SUPPORT: Job = {
  title: "Customer Support Officer",
  place: "BrightLine Telecom, London",
  duty: "- Handled 60+ customer calls and live chats a day, logged every case in the ticketing system",
  skills: ["Customer service", "Phone support", "Ticketing / CRM"],
  extraSkills: ["Live chat", "MS Office"],
};
const SALES: Job = {
  title: "Sales Executive",
  place: "Metro Home Appliances, London",
  duty: "- Field sales and lead generation across north London, met monthly targets for 8 months in a row",
  skills: ["Field sales", "Lead generation", "Customer service"],
  extraSkills: ["CRM", "Target achievement"],
};

function cvFor(p: Person, i: number, job: Job) {
  const email = `${p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, ".")}@example.com`;
  // 07700 900xxx is the UK range reserved for fiction, so no real person is ever messaged.
  const phone = `07700 900${String(100 + i * 13).padStart(3, "0").slice(-3)}`;
  const now = new Date().getFullYear();
  const lines = [p.name, `${p.city} | ${email} | ${phone}`, ""];
  if (p.profile === "strong") {
    lines.push(
      "PROFILE",
      `${job.title} with ${p.years} years of experience. Calm, friendly and well organised.`,
      "",
      "EXPERIENCE",
      `${job.title}, ${job.place} (${now - p.years} - Present)`,
      job.duty,
      "",
      "SKILLS",
      `Skills: ${[...job.skills, ...(p.years >= 3 ? [job.extraSkills[0]] : []), ...(p.years % 2 ? [job.extraSkills[1]] : []), ...(p.extra ? [p.extra] : [])].join(", ")}`,
      "Languages: English (native), French (conversational)",
      "",
      "EDUCATION",
      "BA (Hons) Business Management, University of Greenwich",
    );
  } else if (p.profile === "maybe") {
    lines.push(
      "PROFILE",
      `Friendly and hard-working, looking for a ${job.title.toLowerCase()} role.`,
      "",
      "EXPERIENCE",
      p.years ? `Sales Assistant, Next, Croydon (${now - p.years} - Present)` : "Work experience, Call Centre, London (3 months)",
      "- Customer service and handling customer complaints",
      "",
      "SKILLS",
      "Skills: Customer service, Cash handling, Communication",
      p.years % 2 ? "Languages: English, Polish" : "Languages: English",
      "",
      "EDUCATION",
      "A-levels, Croydon College",
    );
  } else {
    lines.push("OBJECTIVE", "Looking for any job to start my career.", "", "EDUCATION", "GCSEs, Harris Academy", "", "SKILLS", "Skills: Hard working, Punctual", "Languages: English");
  }
  return { text: lines.join("\n"), email, phone };
}

function answersFor(role: Role, p: Person): Answer[] {
  return role.screening.map((q) => {
    let answer = "";
    if (q.type === "yesno") answer = p.profile === "weak" && q.id === "q2" ? "no" : p.profile === "maybe" && q.id === "q3" && p.years % 2 ? "no" : "yes";
    else
      answer =
        p.profile === "strong"
          ? "A customer was angry about a late delivery. I apologised, checked the order while they waited, gave an honest new time and called back when it was sent. They thanked us later."
          : p.profile === "maybe"
            ? "I listened to the customer and solved the problem."
            : "";
    return { id: q.id, question: q.question, answer };
  });
}

const SUPPORT_PEOPLE: Person[] = [
  { name: "Hannah Brooks", city: "London", src: "facebook", years: 3, profile: "strong", extra: "Complaint handling" },
  { name: "Amelia Clarke", city: "London", src: "whatsapp", years: 2, profile: "strong" },
  { name: "Megan Hughes", city: "London", src: "website", years: 4, profile: "strong" },
  { name: "Oliver Patel", city: "London", src: "linkedin", years: 2, profile: "strong" },
  { name: "Freya Walsh", city: "London", src: "poster", years: 1, profile: "strong" },
  { name: "Chloe Turner", city: "London", src: "link", years: 2, profile: "maybe" },
  { name: "James O'Connor", city: "London", src: "facebook", years: 1, profile: "maybe" },
  { name: "Sophie Bennett", city: "Croydon", src: "whatsapp", years: 3, profile: "maybe" },
  { name: "Daniel Murphy", city: "London", src: "indeed", years: 0, profile: "maybe" },
  { name: "Grace Evans", city: "London", src: "instagram", years: 1, profile: "maybe" },
  { name: "Liam Harris", city: "London", src: "facebook", years: 0, profile: "weak" },
  { name: "Maria Novak", city: "London", src: "website", years: 0, profile: "weak" },
  { name: "Kieran Doyle", city: "Watford", src: "facebook", years: 0, profile: "weak" },
  { name: "Ellie Morgan", city: "London", src: "whatsapp", years: 0, profile: "weak" },
  { name: "Rebecca Lewis", city: "London", src: "linkedin", years: 5, profile: "strong", extra: "Team lead" },
  { name: "Tom Fletcher", city: "London", src: "indeed", years: 1, profile: "maybe" },
];

const SALES_PEOPLE: Person[] = [
  { name: "Ethan Wright", city: "London", src: "facebook", years: 3, profile: "strong" },
  { name: "Jack Robinson", city: "London", src: "whatsapp", years: 2, profile: "strong" },
  { name: "Lucy Ward", city: "London", src: "instagram", years: 1, profile: "maybe" },
  { name: "Ryan Cooper", city: "London", src: "link", years: 0, profile: "weak" },
  { name: "Oscar Bailey", city: "London", src: "linkedin", years: 4, profile: "strong" },
];

// ---------- Seed ----------

export async function seed(db: Queryable) {
  // The one owner account. Live: OWNER_EMAIL / OWNER_PASSWORD. Demo: one-click demo login.
  const ownerId = (await db.one<{ id: number }>("insert into users (name, email, password_hash, kind) values ($1, lower($2), $3, 'owner') returning id", [
    process.env.OWNER_NAME ?? "JobBridge Owner",
    process.env.OWNER_EMAIL ?? "owner@jobbridge.test",
    await bcrypt.hash(process.env.OWNER_PASSWORD ?? "Demo@1234", 10),
  ]))!.id;

  // The business this app runs for.
  const business = (await db.one<Company>(
    `insert into companies (owner_id, slug, name, industry, size, tagline, about, address, city, phone, email, website, sign_as, tone, brand_color, accent_color, slot_minutes, interview_location)
     values ($1,'jobbridge','JobBridge','Recruitment','11-50','Connecting talent to opportunity',
       'JobBridge connects good people with good jobs. We are a growing team in London and we hire for attitude, then train for skill.',
       '2nd Floor, 14 Old Street, London EC1V 9BH','London','020 7946 0000','careers@jobbridge.test','https://jobbridge.test',
       'The JobBridge Team','friendly, clear and confident','#063B67','#047CD3',30,'JobBridge office, 2nd Floor, 14 Old Street, London EC1V 9BH (ask at reception)')
     returning *`,
    [ownerId],
  ))!;
  for (const wd of [1, 2, 3, 4, 5]) await db.q("insert into availability (company_id, weekday, start_time, end_time) values ($1,$2,'10:00','12:00')", [business.id, wd]);

  if (process.env.DEMO_MODE === "off") return;
  await seedDemo(db, business);
}

async function seedDemo(db: Queryable, c: Company) {
  const role = async (r: Partial<Role> & { title: string }, status: Role["status"], daysAgo: number, extra: Partial<Role> = {}) => {
    const draft = { languages: [], must_have: [], nice_to_have: [], duties: [], screening: [], openings: 1, min_experience: 0, employment: "Full-time", ...r } as unknown as Role;
    const post = templateJobPost(draft, c);
    const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return (await db.one<Role>(
      `insert into roles (company_id, slug, code, title, department, employment, shift, hours, salary_min, salary_max, location, city, openings, languages, min_experience, duties, must_have, nice_to_have, start_date, notes,
         status, reviewed_at, closed_reason, description, post_facebook, post_instagram, post_whatsapp, post_linkedin, poster_headline, poster_tagline, screening, poster, written_by, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,'template', now() - make_interval(mins => $33)) returning *`,
      [c.id, slug, code(), r.title, draft.department ?? null, draft.employment, draft.shift ?? null, draft.hours ?? null, draft.salary_min ?? null, draft.salary_max ?? null, draft.location ?? null, draft.city ?? c.city,
        draft.openings, j(draft.languages), draft.min_experience, j(draft.duties), j(draft.must_have), j(draft.nice_to_have), draft.start_date ?? null, draft.notes ?? null,
        status, status === "draft" ? null : new Date(Date.now() - (daysAgo - 0.2) * 86400_000), extra.closed_reason ?? null,
        post.description, post.facebook, post.instagram, post.whatsapp, post.linkedin, extra.poster_headline ?? post.poster_headline, extra.poster_tagline ?? post.poster_tagline,
        j(post.screening), extra.poster ? j(extra.poster) : null, Math.round(daysAgo * 1440)],
    ))!;
  };

  // Messages are back-dated so the WhatsApp screen reads like a real week of hiring.
  const msg = (aid: number, channel: string, to: string | null, kind: string, subject: string, body: string, hoursAgo: number, direction = "out") =>
    db.q(
      `insert into messages (applicant_id, channel, to_addr, kind, subject, body, direction, status, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8, now() - make_interval(mins => $9))`,
      [aid, channel, to, kind, subject, body, direction, direction === "in" ? "received" : "demo", Math.round(hoursAgo * 60)],
    );
  const wa = (s: string) => s.replace(/\n\n+/g, "\n\n");

  const applicants = async (r: Role, people: Person[], job: Job, startIndex: number) => {
    const out: Record<string, Applicant> = {};
    for (const [k, p] of people.entries()) {
      const cv = cvFor(p, startIndex + k, job);
      const answers = answersFor(r, p);
      const a = rulesAnalyze(r, cv.text, answers);
      const hoursAgo = 4 + k * 6;
      const row = (await db.one<Applicant>(
        `insert into applicants (role_id, name, email, phone, city, source, cv_name, cv_text, parsed, answers, score, band, breakdown, summary, scored_by, duplicate_count, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'rules',$15, now() - make_interval(hours => $16)) returning *`,
        [r.id, p.name, cv.email, cv.phone, p.city, p.src, `${p.name.replace(/\s+/g, "_")}_CV.pdf`, cv.text, j(a.parsed), j(answers), a.score, a.band, j(a.breakdown), j(a.summary), k === 6 ? 1 : 0, hoursAgo],
      ))!;
      out[p.name] = row;
      const m = templates.received(row, r, c);
      await msg(row.id, "whatsapp", row.phone, "received", m.subject, wa(m.body), hoursAgo);
      await msg(row.id, "email", row.email, "received", m.subject, m.body, hoursAgo);
    }
    await db.q("insert into activity (company_id, role_id, text, created_at) values ($1,$2,$3, now() - interval '6 days')", [c.id, r.id, `Published: ${r.title} is live on the careers site`]);
    return out;
  };

  const token = () => crypto.randomBytes(18).toString("base64url");
  const invite = async (r: Role, a: Applicant, hoursAgo: number, t: string) => {
    await db.q("insert into interviews (applicant_id, role_id, token, created_at) values ($1,$2,$3, now() - make_interval(hours => $4))", [a.id, r.id, t, hoursAgo]);
    await db.q("update applicants set stage = 'invited' where id = $1", [a.id]);
    const m = templates.invite(a, r, c, t);
    await msg(a.id, "whatsapp", a.phone, "invite", m.subject, wa(m.body), hoursAgo);
    await msg(a.id, "email", a.email, "invite", m.subject, m.body, hoursAgo);
  };
  const book = async (r: Role, a: Applicant, t: string, daysAhead: number, hour: string, hoursAgo: number) => {
    const when = zoned(dayKey(new Date(Date.now() + daysAhead * 86400_000)), hour);
    await db.q("update interviews set status = 'booked', starts_at = $2, ends_at = $3 where token = $1", [t, when, new Date(when.getTime() + c.slot_minutes * 60_000)]);
    await db.q("update applicants set stage = 'booked' where id = $1", [a.id]);
    const m = templates.booked(a, r, c, when, t);
    await msg(a.id, "whatsapp", a.phone, "booked", m.subject, wa(m.body), hoursAgo);
  };

  // ===== 1. Customer Support Officer: live, 2 openings, 1 hired, busy pipeline =====
  const support = await role({
    title: "Customer Support Officer", department: "Customer Support", shift: "Day shift", hours: "9:00 am – 5:30 pm, Mon–Fri", salary_min: 24000, salary_max: 28000,
    location: "Old Street, London", openings: 2, languages: ["English"], min_experience: 1,
    must_have: ["Customer service", "Phone support", "CRM or ticketing"], nice_to_have: ["Live chat", "MS Office"],
    start_date: new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10),
  }, "open", 6, { poster_headline: "Be the voice people trust", poster_tagline: "Help candidates and companies every day" });
  const sp = await applicants(support, SUPPORT_PEOPLE, SUPPORT, 0);

  const hannahT = token();
  await invite(support, sp["Hannah Brooks"], 30, hannahT);
  await book(support, sp["Hannah Brooks"], hannahT, 1, "11:00", 29);
  await msg(sp["Hannah Brooks"].id, "whatsapp", sp["Hannah Brooks"].phone, "inbound", "", "Thank you so much! See you then 😊", 28.8, "in");

  const rebeccaT = token();
  await invite(support, sp["Rebecca Lewis"], 70, rebeccaT);
  await msg(sp["Rebecca Lewis"].id, "whatsapp", sp["Rebecca Lewis"].phone, "inbound", "", "Hi, is the office easy to reach by Tube?", 69.5, "in");
  await msg(sp["Rebecca Lewis"].id, "whatsapp", sp["Rebecca Lewis"].phone, "reply", "", "Hi Rebecca! Yes, we're a 2-minute walk from Old Street station (Northern line). See you soon.", 69.2);
  await db.q("update interviews set status = 'completed', starts_at = now() - interval '44 hours', ends_at = now() - interval '43.5 hours' where token = $1", [rebeccaT]);
  await db.q("update applicants set stage = 'hired' where id = $1", [sp["Rebecca Lewis"].id]);
  const hired = templates.hired(sp["Rebecca Lewis"], support, c);
  await msg(sp["Rebecca Lewis"].id, "whatsapp", sp["Rebecca Lewis"].phone, "hired", hired.subject, wa(hired.body), 20);
  await msg(sp["Rebecca Lewis"].id, "whatsapp", sp["Rebecca Lewis"].phone, "inbound", "", "Brilliant news, thank you so much! I'm really excited to join 🙌", 19.6, "in");

  const mT = token();
  await invite(support, sp["Megan Hughes"], 6, mT);
  await msg(sp["Megan Hughes"].id, "whatsapp", sp["Megan Hughes"].phone, "inbound", "", "Could I change my interview time? I have a uni exam on Wednesday.", 2, "in");
  await msg(sp["Megan Hughes"].id, "whatsapp", sp["Megan Hughes"].phone, "auto_reply", "New time", `No problem, Megan! You can pick a new interview time here:\n${baseUrl()}/book/${mT}`, 1.98);

  // ===== 2. Sales Executive: live, 3 openings, saved "Spotlight" poster =====
  const salesBase = {
    title: "Sales Executive", department: "Sales", shift: "Day shift", hours: "9:00 am – 5:30 pm, Mon–Fri", salary_min: 26000, salary_max: 30000,
    location: "London (field + office)", openings: 3, languages: ["English"], min_experience: 1,
    must_have: ["Field sales", "Lead generation", "Customer service"], nice_to_have: ["CRM", "Target achievement"],
  };
  const salesPoster: PosterDesign = {
    v: 2, template: "bold", kicker: "We are", headline: "Counting on you", tagline: "Hiring 3 Sales Executives now",
    label: "Open Position", title: "Sales Executive", intro: "Grow with a team that wins together, with monthly commission on top of your salary.",
    points: ["$26k – $30k /yr + commission", "Full-time · Mon–Fri", "London (field + office)"], cta: "Apply Now",
    contact: "careers@jobbridge.test", footer: "www.jobbridge.test", bg: "#063B67", accent: "#7DC4FA", text: "#FFFFFF",
  };
  const sales = await role(salesBase, "open", 3, { poster: salesPoster });
  const sl = await applicants(sales, SALES_PEOPLE, SALES, 30);
  await invite(sales, sl["Oscar Bailey"], 10, token());

  // ===== 3. Recruitment Coordinator: draft, ready to publish =====
  await role({
    title: "Recruitment Coordinator", department: "Talent", shift: "Day shift", hours: "9:00 am – 5:30 pm, Mon–Fri", salary_min: 28000, salary_max: 32000,
    location: "Old Street, London", openings: 1, languages: ["English"], min_experience: 2,
    must_have: ["Recruitment experience", "Interview scheduling", "Excel"], nice_to_have: ["LinkedIn sourcing"],
  }, "draft", 0.1);

  // ===== 4. Office Assistant: filled and closed automatically =====
  await role({
    title: "Office Assistant", department: "Operations", shift: "Day shift", hours: "9:00 am – 5:30 pm, Mon–Fri", salary_min: 22000, salary_max: 24000,
    location: "Old Street, London", languages: ["English"], min_experience: 0, must_have: ["Office support", "Punctuality"],
  }, "closed", 40, { closed_reason: "filled" });
}
