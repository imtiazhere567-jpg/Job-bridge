import type { Company, Role, ScreeningQuestion } from "./types";

/** The currency every salary is shown in. Change it here to switch the whole app. */
export const CURRENCY = "$";
/** e.g. "$28,000". */
export const cash = (n: number | null) => (n ? `${CURRENCY}${n.toLocaleString("en-GB")}` : "");
export const SALARY_PERIODS = ["year", "month"] as const;

export const WORK_MODES = ["On-site", "Remote", "Hybrid"] as const;

/** Where the job is done, e.g. "Remote", "Hybrid · London" or "Shoreditch, London". */
export function placeText(role: Pick<Role, "work_mode" | "location" | "city">) {
  const where = role.location ?? role.city ?? "";
  if (role.work_mode === "Remote") return "Remote";
  if (role.work_mode === "Hybrid") return where ? `Hybrid · ${where}` : "Hybrid";
  return where;
}

/** "$24,000 – $28,000 a year", "$2,100 a month", or "Competitive salary". Short form for posters: "$24k – $28k /yr". */
export function salaryText(role: Pick<Role, "salary_min" | "salary_max"> & { salary_period?: string | null }, short = false) {
  const per = role.salary_period === "month" ? (short ? " /mo" : " a month") : short ? " /yr" : " a year";
  const money = (n: number) => (short && n >= 10000 && n % 1000 === 0 ? `${CURRENCY}${n / 1000}k` : cash(n));
  const { salary_min: lo, salary_max: hi } = role;
  if (lo && hi && lo !== hi) return `${money(lo)} – ${money(hi)}${per}`;
  if (lo || hi) return `${lo && !hi ? "From " : !lo && hi ? "Up to " : ""}${money((lo || hi)!)}${per}`;
  return "Competitive salary";
}

/**
 * What a job usually involves, by title, so the built-in writer can describe it properly
 * when Claude is off (duties, what to look for, extra requirements and a closing line).
 */
interface Kind {
  re: RegExp;
  duties: string[];
  adjectives: string[];
  traits: string;
  requirements: string[];
  offers: string[];
  closing: string;
  portfolio?: boolean;
}
const KINDS: Kind[] = [
  {
    re: /video|editor|motion|animat|film/i,
    duties: ["Edit and produce high-quality videos for social media, websites and marketing campaigns", "Create engaging short-form videos, reels and promotional content", "Add transitions, animations, sound effects, subtitles and background music", "Make sure videos match the company's branding and creative direction", "Work with the team to understand each project and deliver on time", "Review and improve videos based on feedback"],
    adjectives: ["creative and skilled", "talented", "creative", "detail-minded"],
    traits: "a passion for video editing, a strong sense of storytelling and the ability to create engaging content for different platforms",
    requirements: ["Good understanding of transitions, colour grading and sound design", "Creativity and attention to detail", "Able to manage several projects and meet deadlines", "A portfolio or previous work samples"],
    offers: ["Diverse creative projects to work on"],
    closing: "turn creative ideas into impactful videos",
    portfolio: true,
  },
  {
    re: /web|developer|software|programmer|engineer|front.?end|back.?end|full.?stack|devops|\bit\b/i,
    duties: ["Build and maintain websites and web applications", "Turn designs into clean, fast and responsive pages", "Fix bugs and improve performance and security", "Work with designers and the team to plan new features", "Test your work and keep code tidy and documented", "Keep up to date with new tools and best practices"],
    adjectives: ["skilled", "talented", "motivated", "problem-solving"],
    traits: "a love of building things that work well, clean coding habits and a good eye for detail",
    requirements: ["Good problem-solving skills", "Able to work in a team and explain your work clearly", "A portfolio, GitHub or examples of sites you have built"],
    offers: ["Modern tools and interesting projects"],
    closing: "build products people love to use",
    portfolio: true,
  },
  {
    re: /graphic|designer|\bui\b|\bux\b|creative|illustrat/i,
    duties: ["Design social media posts, adverts, posters and brochures", "Create visuals that match the brand's look and feel", "Prepare files for print and digital use", "Work with the team to understand each brief", "Present ideas and improve designs based on feedback", "Keep design files organised"],
    adjectives: ["creative", "talented", "skilled", "imaginative"],
    traits: "a strong eye for design, creative ideas and great attention to detail",
    requirements: ["A good sense of layout, colour and typography", "Able to manage several projects and meet deadlines", "A portfolio of your design work"],
    offers: ["Creative freedom on varied projects"],
    closing: "bring great ideas to life",
    portfolio: true,
  },
  {
    re: /market|social media|seo|content|copywrit|digital/i,
    duties: ["Plan and run marketing campaigns across social media and online", "Create posts, captions and simple content", "Track results and share what works", "Grow followers, leads and engagement", "Work with the team on new ideas and launches", "Keep the brand voice consistent everywhere"],
    adjectives: ["creative", "driven", "skilled", "energetic"],
    traits: "creative ideas, good writing skills and an understanding of what makes people click",
    requirements: ["Good written English", "Comfortable with social media platforms and simple analytics", "Examples of campaigns or content you have worked on"],
    offers: ["Room to try new ideas and see their results"],
    closing: "help more people discover our brand",
    portfolio: true,
  },
  {
    re: /recept|front desk|front office/i,
    duties: ["Welcome visitors and customers warmly", "Book, confirm and reschedule appointments", "Answer calls, emails and messages", "Keep records tidy and up to date", "Keep the reception area neat and welcoming", "Help the team with day-to-day admin"],
    adjectives: ["friendly", "organised", "welcoming", "reliable"],
    traits: "a warm, friendly manner, good organisation and clear communication",
    requirements: ["Good communication skills", "Organised and reliable"],
    offers: [],
    closing: "be the friendly first face of our business",
  },
  {
    re: /customer|support|service|call cent|help ?desk/i,
    duties: ["Answer customer calls, emails and chats", "Solve problems and questions quickly and politely", "Log every case clearly in the system", "Follow up so nothing is left unanswered", "Pass on feedback to help improve the service", "Work closely with the team on busy days"],
    adjectives: ["friendly", "patient", "helpful", "reliable"],
    traits: "a friendly, patient manner, clear communication and a real wish to help people",
    requirements: ["Good communication skills", "Calm under pressure"],
    offers: [],
    closing: "make every customer's day a little better",
  },
  {
    re: /sales|business develop|account manag/i,
    duties: ["Find and follow up with new customers", "Explain products clearly and honestly", "Build good relationships with customers", "Reach monthly targets", "Keep customer records up to date", "Share market feedback with the team"],
    adjectives: ["driven", "confident", "motivated", "results-focused"],
    traits: "confidence with people, a positive attitude and the drive to reach targets",
    requirements: ["Good communication and listening skills", "Target-driven and self-motivated"],
    offers: ["Commission or bonuses for good results"],
    closing: "grow your sales career with us",
  },
  {
    re: /recruit|hr\b|human resource|talent/i,
    duties: ["Post jobs and find good candidates", "Screen CVs and arrange interviews", "Keep candidates updated at every step", "Support new starters with onboarding", "Keep hiring records accurate", "Work with managers on what each team needs"],
    adjectives: ["organised", "people-focused", "experienced", "friendly"],
    traits: "good people skills, strong organisation and an eye for talent",
    requirements: ["Good communication skills", "Organised and able to handle several roles at once"],
    offers: [],
    closing: "help us find great people",
  },
  {
    re: /nurse|\bcare\b|carer|dental|medical|health/i,
    duties: ["Support patients or clients with care and respect", "Prepare rooms and equipment", "Follow hygiene and safety rules", "Keep records up to date", "Work closely with the wider team", "Help people feel comfortable and safe"],
    adjectives: ["caring", "compassionate", "reliable", "experienced"],
    traits: "a caring nature, patience and high standards of hygiene and safety",
    requirements: ["Caring and patient", "Follows procedures carefully"],
    offers: [],
    closing: "make a real difference to people every day",
  },
  {
    re: /office|admin|assistant|clerk|data entry|secretar/i,
    duties: ["Handle day-to-day office tasks and admin", "Keep files and records organised", "Answer calls and emails", "Order supplies and keep the office running smoothly", "Support the team with whatever they need", "Enter and check data accurately"],
    adjectives: ["organised", "reliable", "helpful", "efficient"],
    traits: "good organisation, a helpful attitude and attention to detail",
    requirements: ["Comfortable with email and basic office software", "Organised and reliable"],
    offers: [],
    closing: "keep our office running smoothly",
  },
  {
    re: /waiter|server|waitress|steward|barista|bar staff/i,
    duties: ["Greet guests and take orders accurately", "Serve food and drinks with care", "Keep tables and service areas clean", "Handle bills and payments", "Answer questions about the menu", "Work as part of a busy team"],
    adjectives: ["friendly", "energetic", "reliable", "welcoming"],
    traits: "a friendly smile, energy and the ability to stay calm when it's busy",
    requirements: ["Friendly and polite with guests", "Able to work busy shifts"],
    offers: ["Staff meals and tips"],
    closing: "give our guests a great experience",
  },
  {
    re: /cook|chef|kitchen/i,
    duties: ["Prepare dishes to the menu standard", "Keep the kitchen clean and safe", "Manage stock and prep lists", "Follow food hygiene rules", "Help plan new dishes", "Work as part of a busy kitchen team"],
    adjectives: ["skilled", "passionate", "experienced", "reliable"],
    traits: "a passion for good food, speed in a busy kitchen and high hygiene standards",
    requirements: ["Food hygiene knowledge", "Able to work well under pressure"],
    offers: ["Staff meals"],
    closing: "cook food people love",
  },
  {
    re: /driver|rider|delivery|courier/i,
    duties: ["Deliver orders on time and safely", "Plan routes to save time", "Keep the vehicle clean and checked", "Be polite and helpful with customers", "Keep delivery records up to date", "Report any problems quickly"],
    adjectives: ["reliable", "careful", "punctual", "friendly"],
    traits: "a safe driving record, good timekeeping and a friendly manner",
    requirements: ["A valid driving licence", "Good knowledge of local roads"],
    offers: [],
    closing: "keep our customers happy on every delivery",
  },
  {
    re: /account|bookkeep|finance|payroll/i,
    duties: ["Record daily transactions", "Prepare monthly reports", "Handle invoices and payments", "Reconcile bank statements", "Keep financial records accurate", "Help with budgets and audits"],
    adjectives: ["detail-minded", "experienced", "organised", "reliable"],
    traits: "strong attention to detail, good number skills and a careful way of working",
    requirements: ["Good with numbers and spreadsheets", "Careful and accurate"],
    offers: [],
    closing: "keep our finances in great shape",
  },
  {
    re: /teach|tutor|instructor|trainer/i,
    duties: ["Plan and deliver engaging lessons", "Check work and track progress", "Keep parents or learners informed", "Support each learner to do their best", "Prepare learning materials", "Keep a safe, positive learning space"],
    adjectives: ["passionate", "patient", "inspiring", "experienced"],
    traits: "patience, clear explanations and a real passion for helping people learn",
    requirements: ["Good communication skills", "Patient and encouraging"],
    offers: [],
    closing: "help learners reach their goals",
  },
  {
    re: /warehouse|picker|packer|stock|logistic|operative/i,
    duties: ["Pick, pack and prepare orders accurately", "Receive and check deliveries", "Keep stock organised and counted", "Follow health and safety rules", "Keep the warehouse clean and tidy", "Work as part of a busy team"],
    adjectives: ["reliable", "hard-working", "careful", "energetic"],
    traits: "a hard-working attitude, accuracy and good timekeeping",
    requirements: ["Able to do physical work", "Reliable and on time"],
    offers: [],
    closing: "keep our orders moving",
  },
];
const DEFAULT_KIND: Kind = {
  re: /./,
  duties: ["Carry out the day-to-day work of the role", "Work closely with the team", "Keep standards high and customers happy", "Take ownership of your work", "Share ideas to improve how we work", "Keep learning and growing"],
  adjectives: ["motivated", "reliable", "skilled", "enthusiastic"],
  traits: "a positive attitude, good attention to detail and a willingness to learn",
  requirements: ["Good communication skills", "Reliable and organised"],
  offers: [],
  closing: "grow your career with us",
};
export const kindOf = (title: string) => KINDS.find((k) => k.re.test(title)) ?? DEFAULT_KIND;

/** "Customer service" → "customer service", but names stay as written: "Adobe Premiere Pro", "CapCut", "Excel". */
const lowerFirst = (s: string) => {
  const words = s.trim().split(/\s+/);
  return words.length > 1 && /^[A-Z][a-z]+$/.test(words[0]) && words.slice(1).every((w) => w === w.toLowerCase()) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
};
const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const an = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const plural = (title: string) => (/s$/i.test(title) ? title : /y$/i.test(title) && !/[aeiou]y$/i.test(title) ? `${title.slice(0, -1)}ies` : `${title}s`);
/** "Adobe Premiere Pro" → "Experience with Adobe Premiere Pro"; full sentences stay as they are. */
const requirementLine = (s: string) =>
  /^(experience|knowledge|ability|able|good|strong|basic|fluent|proven|confident|comfortable|a |an |at least|proficien|understanding|familiar)/i.test(s) || /\b(experience|knowledge|skills?)\b/i.test(s) || s.split(" ").length > 5
    ? s
    : `Experience with ${lowerFirst(s)}`;

export function dutiesFor(role: Pick<Role, "title" | "duties">) {
  if (role.duties.length) return role.duties;
  return kindOf(role.title).duties;
}

/** How many wording styles the template writer has. "Rewrite" moves to the next one when Claude is off. */
export const TEMPLATE_STYLES = 4;

/** Template writer used when Claude is not configured. `style` (0–3) picks one of four wordings. */
export function templateJobPost(role: Role, company: Company, style = 0) {
  const v = ((style % TEMPLATE_STYLES) + TEMPLATE_STYLES) % TEMPLATE_STYLES;
  const pick = <T,>(options: T[]) => options[v % options.length];
  const shift = [role.employment, role.shift].filter(Boolean).join(", ");
  const langs = role.languages.length ? `Comfortable speaking ${role.languages.join(" and ")}` : "";
  const exp = role.min_experience > 0 ? `At least ${role.min_experience} year${role.min_experience > 1 ? "s" : ""} of relevant experience` : "";
  const must = [...role.must_have, exp, langs].filter(Boolean);
  const where = role.work_mode === "Remote" ? "" : role.location ?? role.city ?? company.city ?? "";
  // "3 people for Waiter / Waitress" reads right for any title (no "Waitresss").
  const seats = role.openings > 1 ? `${role.openings} people for the ${role.title} role` : `a ${role.title}`;
  const place = role.work_mode === "Remote" ? " (fully remote, work from home)" : where ? ` in ${where}${role.work_mode === "Hybrid" ? " (hybrid: some days from home)" : ""}` : "";
  const pay = salaryText(role);
  const hours = `${shift}${role.hours ? ` (${role.hours})` : ""}`;
  const start = role.start_date ? new Date(role.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  const kind = kindOf(role.title);
  const perks = pick([
    "A respectful, supportive team and proper training",
    "Full training and a friendly team who'll help you settle in",
    "Real support from day one, and room to grow with us",
    "A welcoming workplace where good work is noticed",
  ]);
  const adjective = pick(kind.adjectives);
  const skillList = role.must_have.filter((m) => !/experience/i.test(m)).slice(0, 3).map((m) => lowerFirst(m));
  const skills = skillList.length ? ` You should be confident with ${joinAnd(skillList)}.` : "";
  const about = pick([
    `We are looking for ${role.openings > 1 ? `${role.openings} ${adjective} ${plural(role.title)}` : `${an(adjective)} ${adjective} ${role.title}`} to join our team${place}. The ideal candidate should have ${kind.traits}.${skills}`,
    `${company.name} is growing, and we need ${role.openings > 1 ? `${role.openings} ${adjective} ${plural(role.title)}` : `${an(adjective)} ${adjective} ${role.title}`}${place}. You will bring ${kind.traits}.${skills}`,
    `Are you ${an(adjective)} ${adjective} ${role.title} looking for your next step? Join ${company.name}${place}. We want someone with ${kind.traits}.${skills}`,
    `This is a great chance for ${an(adjective)} ${adjective} ${role.title} to join ${company.name}${place}. The right person has ${kind.traits}.${skills}`,
  ]);
  const requirements = [
    ...role.must_have.map(requirementLine),
    exp || (role.min_experience === 0 ? "No experience needed: full training is given" : ""),
    langs,
    ...kind.requirements,
  ].filter(Boolean);
  const offers = [
    pay !== "Competitive salary" ? `${pay}${role.salary_period === "month" ? "" : ", paid monthly"}` : "A competitive salary",
    `${shift}${role.hours ? ` (${role.hours})` : ""}`.trim(),
    ...kind.offers,
    perks,
    "Opportunities to learn, grow and improve your skills",
  ].filter(Boolean);
  const applyText = pick([
    `Interested? Fill in the short application form and upload your CV${kind.portfolio ? " and a link to your portfolio" : ""}. It takes about 3 minutes, and you'll get a confirmation straight away.`,
    `Apply through the short form: add your details and upload your CV${kind.portfolio ? ", plus your portfolio or work samples" : ""}. It takes about 3 minutes.`,
    `Send us your CV${kind.portfolio ? " and portfolio" : ""} through the apply form (about 3 minutes). Shortlisted people get a link to pick an interview time.`,
    `Click apply, fill in a few details and upload your CV${kind.portfolio ? " and work samples" : ""}. We'll confirm we've received it right away.`,
  ]);
  const closing = pick([`Join our team and ${kind.closing}!`, `Come and ${kind.closing} with ${company.name}!`, `Apply today and ${kind.closing}!`, `We'd love to hear from you. Join us and ${kind.closing}!`]);

  const facts: [string, string][] = [
    ["Company", company.name],
    ["Position", role.title],
    ["Job Type", role.employment || "Full-time"],
    ["Work Mode", role.work_mode || "On-site"],
    ...(where ? ([["Location", where]] as [string, string][]) : []),
    ...(role.openings > 1 ? ([["Openings", `${role.openings} positions`]] as [string, string][]) : []),
    ...(start ? ([["Start date", start]] as [string, string][]) : []),
  ];
  const description = [
    `We're Hiring: ${role.title}`,
    ...facts.map(([k, val]) => `${k}: ${val}`),
    "",
    "About the Role",
    `${about}${company.about ? ` ${company.about}` : ""}`,
    "",
    "Responsibilities",
    ...dutiesFor(role).map((d) => `- ${d}`),
    "",
    "Requirements",
    ...requirements.map((m) => `- ${m}`),
    ...(role.nice_to_have.length ? ["", "Nice to Have", ...role.nice_to_have.map((n) => `- ${requirementLine(n)}`)] : []),
    "",
    "What We Offer",
    ...offers.map((o) => `- ${o}`),
    "",
    "How to Apply",
    applyText,
    "",
    closing,
  ].join("\n");

  const bullets = must.slice(0, 3).map((m) => `• ${m}`).join("\n");
  const tag = company.name.replace(/[^a-z0-9]/gi, "");
  const roleTag = role.title.replace(/[^a-z]/gi, "").toLowerCase();
  const facebook = pick([
    `We're hiring at ${company.name}! 🎉\n\nWe need ${seats} (${shift}).\n\n${bullets}\n\n💰 ${pay}\n📍 ${where}\n\nApply in 3 minutes, no need to message us. Upload your CV here: {APPLY_LINK}`,
    `📢 New job at ${company.name}: ${role.title}${role.openings > 1 ? ` (${role.openings} openings)` : ""}\n\n✅ ${shift}\n💰 ${pay}\n📍 ${where || "Remote"}\n\nWe're looking for:\n${bullets}\n\nKnow someone perfect for this? Tag them below 👇\nApply here: {APPLY_LINK}`,
    `Looking for your next job? 👀\n\n${company.name} is hiring ${seats}${place}.\n\nWhat you'll need:\n${bullets}\n\nWhat you'll get: ${pay}, ${perks.toLowerCase()}.\n\nIt only takes 3 minutes to apply 👉 {APPLY_LINK}`,
    `Join our team! ${company.name} is looking for ${seats}.\n\n🕘 ${hours}\n💷 ${pay}\n📍 ${where || "Remote"}\n\n${bullets}\n\nSend your CV in 3 minutes: {APPLY_LINK}\nPlease share 🙏`,
  ]);
  const instagram = pick([
    `Join the ${company.name} team ✨ We're hiring ${seats} (${shift}). ${pay}. Apply through the link in our bio.\n\n#hiring #ukjobs #${roleTag} #${tag}`,
    `WE'RE HIRING 📣 ${role.title}${role.openings > 1 ? ` x${role.openings}` : ""} · ${shift} · ${pay}. Tap the link in our bio to apply in 3 minutes.\n\n#nowhiring #jobsuk #${roleTag} #${tag}`,
    `Your next chapter could start here 💼 ${company.name} is looking for ${seats}${place}. Link in bio to apply.\n\n#careers #hiringnow #${roleTag} #${tag}`,
    `New role alert 🚨 ${role.title} at ${company.name}. ${pay}, ${shift.toLowerCase()}. Apply via the link in our bio and tag a friend who'd love this!\n\n#jobs #ukhiring #${roleTag} #${tag}`,
  ]);
  const whatsapp = pick([
    `*${company.name} is hiring*\n${role.title}${role.openings > 1 ? ` (${role.openings} posts)` : ""} – ${shift}\n${pay}\n\n${bullets}\n\nApply here (3 min): {APPLY_LINK}`,
    `*Job opening: ${role.title}*\n📍 ${where || "Remote"}\n🕘 ${shift}\n💰 ${pay}\n\nApply in 3 minutes: {APPLY_LINK}\n\nPlease forward to anyone who might be interested 🙏`,
    `Hi! ${company.name} is looking for ${seats}.\n\n${bullets}\n\n${pay} · ${shift}\nApply: {APPLY_LINK}`,
    `*We're hiring* 🎉\n${company.name} needs ${seats}${place}.\n${pay}\n\nSend your CV here (takes 3 min): {APPLY_LINK}`,
  ]);
  const linkedin = pick([
    `${company.name} is growing, and we're looking for ${seats} to join our team${place}.\n\nThis is a ${shift.toLowerCase()} role.\n\nWhat we're looking for:\n${must.map((m) => `• ${m}`).join("\n")}\n\nWe offer ${pay.toLowerCase()}, a supportive team and proper training.\n\nApply here: {APPLY_LINK}`,
    `We're hiring: ${role.title}${place}.\n\nAt ${company.name}, we're building a team that cares about doing great work. We're looking for someone with:\n${must.map((m) => `• ${m}`).join("\n")}\n\n${shift} · ${pay}\n\nInterested, or know someone who would be? Apply here: {APPLY_LINK}`,
    `Join ${company.name} as ${role.openings > 1 ? `one of our ${role.openings} new ${role.title}s` : `our new ${role.title}`}.\n\nIn this role you will:\n${dutiesFor(role).slice(0, 3).map((d) => `• ${d}`).join("\n")}\n\nWe offer ${pay.toLowerCase()} and ${perks.toLowerCase()}.\n\nApply in about 3 minutes: {APPLY_LINK}`,
    `Opportunity at ${company.name} 🚀\n\nWe're looking for ${seats} (${shift.toLowerCase()}).\n\nThe skills that matter most:\n${must.slice(0, 4).map((m) => `• ${m}`).join("\n")}\n\nPay: ${pay}\n\nFind out more and apply: {APPLY_LINK}\n\n#hiring #${roleTag}`,
  ]);

  return {
    description,
    facebook,
    instagram,
    whatsapp,
    linkedin,
    poster_headline: pick([
      `Join our ${role.department ? role.department.toLowerCase() : ""} team`.replace(/\s+/g, " "),
      `Grow with ${company.name}`,
      "Your next career move",
      `Be part of our ${role.department ? role.department.toLowerCase() : ""} team`.replace(/\s+/g, " "),
    ]),
    poster_tagline: pick([`Grow your career with ${company.name}`, "Full training and a friendly team", "Apply in just 3 minutes", "Great people, real support, room to grow"]),
    screening: templateScreening(role),
  };
}

export function templateScreening(role: Role): ScreeningQuestion[] {
  const qs: ScreeningQuestion[] = [];
  if (role.shift) qs.push({ id: "q1", question: `Can you work the ${role.shift.toLowerCase()}${role.hours ? ` (${role.hours})` : ""}?`, type: "yesno", ideal: "yes" });
  if (role.min_experience > 0)
    qs.push({ id: "q2", question: `Do you have at least ${role.min_experience} year${role.min_experience > 1 ? "s" : ""} of relevant experience?`, type: "yesno", ideal: "yes" });
  if (role.languages.length) qs.push({ id: "q3", question: `Can you speak ${role.languages.join(" and ")} comfortably at work?`, type: "yesno", ideal: "yes" });
  if (role.start_date) qs.push({ id: "q4", question: "Can you start on the given start date?", type: "yesno", ideal: "yes" });
  qs.push({ id: "q5", question: "Tell us about a time you helped an upset or worried customer. What did you do?", type: "text" });
  return qs.map((q, i) => ({ ...q, id: `q${i + 1}` }));
}

/** Plain-text helper to render the description's simple markup. */
/** Key facts written as "Company: Ranklocale", "Job Type: Full-time"… at the top of a description. */
const FACT = /^(company|position|job type|work mode|location|salary|hours|openings|start date|team|department|job title|contract|shift)\s*:\s*(.{1,120})$/i;

export function descriptionBlocks(text: string) {
  const blocks: { type: "title" | "facts" | "h" | "p" | "ul"; text?: string; items?: string[]; facts?: [string, string][] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const fact = line.match(FACT);
    if (/^(we'?re|we are|now) hiring\b/i.test(line) && line.length < 90 && !blocks.length) {
      blocks.push({ type: "title", text: line.replace(/\*\*/g, "") });
    } else if (fact && !/[.!?]$/.test(line)) {
      const last = blocks[blocks.length - 1];
      const pair: [string, string] = [fact[1].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bOf\b/g, "of"), fact[2].trim()];
      if (last?.type === "facts") last.facts!.push(pair);
      else blocks.push({ type: "facts", facts: [pair] });
    } else if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
      const last = blocks[blocks.length - 1];
      const item = line.slice(2).replace(/^\*\*|\*\*$/g, "");
      if (last?.type === "ul") last.items!.push(item);
      else blocks.push({ type: "ul", items: [item] });
    } else if (/^#+\s/.test(line) || (line.length < 40 && !/[.!?:,]$/.test(line))) {
      blocks.push({ type: "h", text: line.replace(/^#+\s*/, "").replace(/\*\*/g, "") });
    } else {
      blocks.push({ type: "p", text: line.replace(/\*\*/g, "") });
    }
  }
  return blocks;
}
