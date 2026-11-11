/** Turns a plain description of a job into New job form fields, and lists what is still missing. */

export const DRAFT_FIELDS = [
  "title",
  "department",
  "employment",
  "work_mode",
  "shift",
  "hours",
  "salary_min",
  "salary_max",
  "salary_period",
  "location",
  "city",
  "openings",
  "start_date",
  "duties",
  "must_have",
  "nice_to_have",
  "languages",
  "min_experience",
  "notes",
] as const;
export type DraftField = (typeof DRAFT_FIELDS)[number];

export interface RoleDraft {
  title: string | null;
  department: string | null;
  employment: "Full-time" | "Part-time" | "Contract" | "Internship" | null;
  work_mode: "On-site" | "Remote" | "Hybrid" | null;
  shift: string | null;
  hours: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: "year" | "month" | null;
  location: string | null;
  city: string | null;
  openings: number | null;
  start_date: string | null;
  duties: string[];
  must_have: string[];
  nice_to_have: string[];
  languages: string[];
  min_experience: number | null;
  notes: string | null;
}
export interface DraftQuestion {
  field: DraftField;
  question: string;
}
export interface DraftResult {
  draft: RoleDraft;
  questions: DraftQuestion[];
  by: "claude" | "rules";
  /** Fields filled with a suggestion (not from the owner's words), so the form can say "check these". */
  suggested?: DraftField[];
}

/**
 * Typical must-have skills by job title, offered when the owner did not list any.
 * Checked top to bottom, so more specific titles come first. Every title gets something:
 * if nothing matches, sensible general skills are suggested (see GENERAL_SKILLS).
 */
const SKILL_HINTS: [RegExp, string[]][] = [
  // Tech
  [/full[- ]?stack/i, ["JavaScript", "React or Vue", "Node.js or PHP", "SQL databases"]],
  [/back[- ]?end|php|laravel|node|python dev|django/i, ["PHP or Node.js", "SQL databases", "REST APIs", "Git"]],
  [/mobile|app developer|android|\bios\b|flutter/i, ["Mobile app development", "Flutter or React Native", "Git"]],
  [/web|website|front[- ]?end|wordpress|shopify/i, ["HTML", "CSS", "JavaScript", "Responsive design"]],
  [/data scien|machine learning|\bai\b engineer/i, ["Python", "Machine learning", "SQL", "Statistics"]],
  [/data analy|business analy|\bbi\b|reporting analyst/i, ["Excel", "SQL", "Power BI or Tableau", "Data analysis"]],
  [/\bqa\b|tester|test engineer|quality assurance/i, ["Manual testing", "Test cases", "Bug reporting", "Attention to detail"]],
  [/devops|cloud|aws|azure|sre\b/i, ["Linux", "Cloud (AWS or Azure)", "CI/CD", "Docker"]],
  [/cyber|security analyst|infosec/i, ["Network security", "Risk assessment", "Firewalls", "Incident response"]],
  [/network|system admin|sysadmin|it support|it technician|helpdesk technician|\bit\b/i, ["IT support", "Windows and Office 365", "Networking basics", "Troubleshooting"]],
  [/developer|programmer|software|coder/i, ["Programming", "Git", "Problem solving"]],
  // Design & media
  [/interior design/i, ["Interior design", "AutoCAD or SketchUp", "Space planning", "Client communication"]],
  [/graphic|designer|\bui\b|\bux\b/i, ["Adobe Photoshop", "Adobe Illustrator", "Figma", "Graphic design"]],
  [/video|editor|motion graphic|animator/i, ["Video editing", "Adobe Premiere Pro", "After Effects"]],
  [/photograph/i, ["Photography", "Adobe Lightroom", "Photo editing", "Lighting"]],
  [/content writer|copywriter|writer|blogger/i, ["Content writing", "SEO", "English grammar"]],
  [/translat|interpret/i, ["Translation", "Fluent in both languages", "Attention to detail"]],
  [/social media/i, ["Social media management", "Content creation", "Canva"]],
  [/\bseo\b/i, ["SEO", "Keyword research", "Google Analytics", "Content optimisation"]],
  [/marketing|brand|advertis/i, ["Digital marketing", "SEO", "Social media"]],
  [/event/i, ["Event planning", "Organisation", "Supplier management", "Communication"]],
  // Office & business
  [/office boy|office runner|peon|tea boy|office helper|messenger|runner/i, ["Office support", "Errands and deliveries", "Tea and refreshments", "Punctuality"]],
  [/recept|front desk|front office/i, ["Customer service", "Phone handling", "MS Office"]],
  [/secretary|personal assistant|\bpa\b|executive assistant/i, ["Diary management", "MS Office", "Organisation", "Communication"]],
  [/data entry|typist/i, ["Fast, accurate typing", "MS Excel", "Attention to detail"]],
  [/admin|office assistant|office manager|clerk/i, ["MS Office", "Typing", "Organisation"]],
  [/recruit|hr\b|human resources|talent/i, ["Recruitment", "Interviewing", "MS Office"]],
  [/payroll/i, ["Payroll processing", "Excel", "PAYE and pensions", "Accuracy"]],
  [/audit/i, ["Auditing", "Financial reporting", "Excel", "Attention to detail"]],
  [/financial analyst|finance analyst/i, ["Financial analysis", "Excel", "Forecasting", "Reporting"]],
  [/account|bookkeep|finance/i, ["Bookkeeping", "Xero or QuickBooks", "Excel"]],
  [/bank|teller|cashier/i, ["Cash handling", "Customer service", "Accuracy", "Basic maths"]],
  [/insurance|underwrit/i, ["Insurance products", "Customer service", "Risk assessment"]],
  [/real estate|estate agent|property|letting/i, ["Property sales or lettings", "Customer service", "Negotiation", "Driving licence"]],
  [/lawyer|solicitor|legal|paralegal|barrister/i, ["Legal research", "Contract drafting", "Attention to detail", "Confidentiality"]],
  [/project manag|program manag|scrum|product manag/i, ["Project planning", "Stakeholder communication", "Risk management", "Agile or Scrum"]],
  [/operations manag|operations/i, ["Operations management", "Team leadership", "Process improvement", "Reporting"]],
  [/procure|purchas|buyer/i, ["Purchasing", "Supplier negotiation", "Stock control", "Excel"]],
  [/logistic|supply chain|dispatch/i, ["Logistics", "Stock control", "Planning", "Excel"]],
  [/store ?keeper|stock ?keeper|inventory/i, ["Stock control", "Inventory records", "Organisation"]],
  [/merchandis/i, ["Visual merchandising", "Stock display", "Retail trends"]],
  // Sales & customers
  [/telesales|telemarket/i, ["Telesales", "Phone skills", "Target driven", "CRM"]],
  [/sales?\b|salesman|salesperson|saleswoman|business develop|account manag/i, ["Sales", "Lead generation", "Customer service", "Negotiation"]],
  [/customer (?:support|service)|call cent|helpdesk|client service/i, ["Customer service", "Phone support", "CRM or ticketing"]],
  [/shop|retail|store assistant|sales assistant/i, ["Customer service", "Till and cash handling", "Stock replenishment"]],
  // Hospitality & food
  [/baker|pastry/i, ["Baking", "Food hygiene", "Early starts"]],
  [/butcher/i, ["Meat preparation", "Knife skills", "Food hygiene"]],
  [/chef|cook|kitchen|dishwasher|kitchen porter/i, ["Food preparation", "Food hygiene"]],
  [/barista/i, ["Coffee making", "Customer service", "Food hygiene"]],
  [/waiter|waitress|server|bar staff|bartender/i, ["Customer service", "Food hygiene"]],
  [/hotel|concierge|guest/i, ["Guest service", "Front desk systems", "Communication"]],
  [/housekeep|room attendant|maid/i, ["Housekeeping", "Attention to detail", "Health and safety"]],
  [/clean|janitor|caretaker/i, ["Cleaning", "Health and safety"]],
  [/travel agent|tour/i, ["Travel booking", "Customer service", "Destination knowledge"]],
  // Driving, warehouse & trades
  [/forklift/i, ["Forklift licence", "Warehouse safety", "Stock handling"]],
  [/driver|courier|delivery|chauffeur/i, ["Full UK driving licence", "Route planning"]],
  [/warehouse|picker|packer|labou?rer|loader/i, ["Stock handling", "Health and safety"]],
  [/security|guard|door ?supervisor/i, ["SIA licence", "Patrolling", "CCTV monitoring", "Incident reporting"]],
  [/electrician/i, ["Electrical installation", "18th Edition wiring regs", "Fault finding", "Health and safety"]],
  [/plumb/i, ["Plumbing installation", "Pipe fitting", "Fault finding", "Health and safety"]],
  [/carpent|joiner/i, ["Carpentry", "Using power tools", "Reading drawings", "Health and safety"]],
  [/mechanic|technician|auto/i, ["Vehicle servicing", "Diagnostics", "Using hand tools", "Health and safety"]],
  [/weld/i, ["Welding (MIG/TIG)", "Reading drawings", "Health and safety"]],
  [/painter|decorator/i, ["Painting and decorating", "Surface preparation", "Attention to detail"]],
  [/construct|site|builder|bricklay/i, ["Construction work", "CSCS card", "Health and safety"]],
  [/civil engineer|structural/i, ["AutoCAD", "Site supervision", "Structural design", "Health and safety"]],
  [/architect/i, ["Architectural design", "AutoCAD or Revit", "Planning regulations"]],
  [/engineer/i, ["Technical problem solving", "Health and safety", "Reading drawings"]],
  [/gardener|landscap|groundskeep/i, ["Gardening", "Using garden machinery", "Plant care"]],
  [/tailor|seamstress|stitch/i, ["Sewing", "Alterations", "Pattern cutting"]],
  [/florist|flower/i, ["Flower arranging", "Customer service", "Plant care", "Creativity"]],
  // Health, care, beauty & education
  [/doctor|physician|\bgp\b/i, ["Patient diagnosis", "GMC registration", "Clinical skills"]],
  [/pharmac/i, ["Dispensing", "Medicines knowledge", "Accuracy"]],
  [/dentist|dental/i, ["Dental procedures", "Patient care", "Infection control"]],
  [/physio/i, ["Physiotherapy", "Patient assessment", "Treatment planning"]],
  [/lab|laborator/i, ["Lab procedures", "Sample handling", "Accuracy", "Health and safety"]],
  [/vet|veterinar|animal/i, ["Animal care", "Handling animals", "Hygiene"]],
  [/nurse|carer|care assistant|support worker|caregiver/i, ["Patient care", "First aid"]],
  [/nanny|babysit|childcare|nursery|au pair/i, ["Childcare", "First aid", "DBS check"]],
  [/hair|barber|stylist/i, ["Hair cutting and styling", "Customer service", "Hygiene"]],
  [/beaut|makeup|nail|spa|therapist/i, ["Beauty treatments", "Customer service", "Hygiene"]],
  [/fitness|personal trainer|gym|coach/i, ["Fitness training", "First aid", "Motivating people"]],
  [/social worker|counsel/i, ["Case management", "Safeguarding", "Empathy"]],
  [/lecturer|professor/i, ["Teaching", "Subject expertise", "Curriculum planning"]],
  [/teacher|tutor|instructor|trainer/i, ["Teaching", "Lesson planning"]],
  [/librar/i, ["Cataloguing", "Customer service", "Organisation"]],
  // Leadership (general)
  [/manager|supervisor|team lead|head of|director/i, ["Team leadership", "Planning", "Communication", "Problem solving"]],
  [/intern|trainee|apprentice|graduate/i, ["Willingness to learn", "Communication", "MS Office", "Teamwork"]],
];

/** Used when a title matches nothing above, so a job never starts with an empty skills list. */
const GENERAL_SKILLS = ["Communication", "Teamwork", "Time management", "Reliability"];

export const suggestSkills = (title: string | null) => (title ? (SKILL_HINTS.find(([re]) => re.test(title))?.[1] ?? GENERAL_SKILLS) : []);

/** The questions to ask when an important field is still empty. */
export function missingQuestions(d: RoleDraft): DraftQuestion[] {
  const q: DraftQuestion[] = [];
  if (!d.title) q.push({ field: "title", question: "What is the job title?" });
  if (!d.must_have.length) q.push({ field: "must_have", question: "Which skills must the person have? (for example: Customer service, MS Excel, Sales)" });
  if (d.salary_min == null && d.salary_max == null) q.push({ field: "salary_min", question: "What is the salary? (for example: $25,000 to $30,000 a year, or $2,100 a month)" });
  if (!d.openings) q.push({ field: "openings", question: "How many people do you need for this job?" });
  if (!d.employment) q.push({ field: "employment", question: "Is it full-time, part-time, contract or an internship?" });
  if (!d.work_mode) q.push({ field: "work_mode", question: "Is the job on-site at the office, remote (work from home) or hybrid?" });
  if (d.work_mode !== "Remote" && !d.location && !d.city) q.push({ field: "location", question: "Where is the job? (area and city)" });
  if (!d.hours && !d.shift) q.push({ field: "hours", question: "What are the working hours and days? (for example: 9 am to 5:30 pm, Mon to Fri)" });
  if (d.min_experience == null) q.push({ field: "min_experience", question: "How many years of experience do you need? (0 if freshers are welcome)" });
  return q;
}

export const emptyDraft = (): RoleDraft => ({
  title: null, department: null, employment: null, work_mode: null, shift: null, hours: null, salary_min: null, salary_max: null, salary_period: null,
  location: null, city: null, openings: null, start_date: null, duties: [], must_have: [], nice_to_have: [], languages: [], min_experience: null, notes: null,
});

// ---------- Built-in reader (works without AI) ----------

const CITIES = ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Glasgow", "Edinburgh", "Bristol", "Sheffield", "Newcastle", "Nottingham", "Leicester", "Cardiff", "Belfast", "Coventry", "Bradford", "Southampton", "Brighton", "Reading", "Oxford", "Cambridge", "Milton Keynes", "Luton", "Croydon", "Slough", "Aberdeen", "York", "Bath", "Exeter", "Norwich", "Plymouth", "Derby", "Wolverhampton", "Stoke"];
const LANGS = ["English", "Welsh", "Polish", "Spanish", "French", "German", "Italian", "Portuguese", "Romanian", "Arabic", "Urdu", "Punjabi", "Hindi", "Bengali", "Mandarin", "Cantonese", "Turkish"];
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1 };
const num = (s: string) => (WORDS[s.toLowerCase()] ?? parseInt(s, 10)) || null;
const money = (n: string, k?: string) => Math.round(parseFloat(n.replace(/,/g, "")) * (k && /k|thousand/i.test(k) ? 1000 : 1));
const cap = (s: string) => s.trim().replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());
const SMALL = ["and", "of", "for", "to", "in", "the"];
const titleCase = (s: string) =>
  s.trim().replace(/\s+/g, " ").split(" ").map((w, i) => (i > 0 && SMALL.includes(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
/**
 * Just the job title: "website developer for company" → "Website Developer",
 * "need a senior chef in Leeds asap" → "Senior Chef", "Sales Executive position" → "Sales Executive".
 */
/** Words that follow "in"/"at" but are not places. */
const PLACE_STOP = new Set(
  "the our a an my your this that these those it its office house home person team total addition charge future time full part sales marketing support design english urdu person people order mind touch advance general particular short case total line person shifts shift morning evening night weekends weekdays january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday hand cash months years days hours one two three four five six seven eight nine ten".split(" "),
);

export function cleanTitle(raw: string): string | null {
  let t = raw.replace(/\s+/g, " ").trim();
  // "in multan", "at our office", "for 2 years": a place or detail, not a job title.
  if (/^(?:in|at|for|to|from|near|on|with|based|located|and|or|of|by)\b/i.test(t)) return null;
  // Drop a leading "we need / hiring / looking for a …"
  t = t.replace(/^(?:we\s+(?:are\s+)?|i\s+)?(?:urgently\s+)?(?:need(?:s|ed)?|hiring|hire|looking for|require[sd]?|want(?:ed)?|recruiting|seeking)\s+/i, "");
  t = t.replace(/^(?:an?|the|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+/i, "");
  // "remote job for a web developer", "urgent vacancy for an accountant": the title comes after "for a".
  const lead = t.match(/^(?:(?:remote|hybrid|on-?site|full[- ]time|part[- ]time|new|urgent)\s+)*(?:job|jobs|vacancy|vacancies|position|role|opening|post)\s+for\s+(?:an?\s+|\d+\s+)?(.+)$/i);
  if (lead) t = lead[1];
  // Cut where extra information starts: "for our company", "in London", "with 2 years", "- urgent".
  t = t.split(/\s+(?:for|in|at|with|to|who|from|on|near|based|that|which|and|asap|urgently|starting|immediately)\b|\s*[,(]|\s+[-–]\s+/i)[0];
  t = t.replace(/\s+(?:job|jobs|position|positions|role|roles|vacancy|vacancies|opening|openings|post|posts|needed|required|wanted)$/i, "");
  t = t.replace(/^(?:remote|hybrid|on-site|onsite|full[- ]time|part[- ]time|new|good|experienced|skilled)\s+/i, "");
  t = t.replace(/\s*\b(?:person|people|staff)$/i, "").trim();
  // Plural "developers" → "developer" (but keep "Sales", "Business", "Glass", "Bus"…)
  if (/[^s]s$/i.test(t) && !/(?:ss|us|is|sales|news)$/i.test(t)) t = t.slice(0, -1);
  // The work → the person doing it: "graphic design" → "Graphic Designer", "video editing" → "Video Editor".
  const PERSON: [RegExp, string][] = [
    [/\bdesign$/i, "Designer"], [/\bdevelopment$/i, "Developer"], [/\bediting$/i, "Editor"], [/\baccounting$/i, "Accountant"],
    [/\bteaching$/i, "Teacher"], [/\bwriting$/i, "Writer"], [/\bphotography$/i, "Photographer"], [/\bnursing$/i, "Nurse"],
    [/\bdriving$/i, "Driver"], [/\bcleaning$/i, "Cleaner"], [/\bbookkeeping$/i, "Bookkeeper"], [/\bprogramming$/i, "Programmer"],
  ];
  for (const [re, who] of PERSON) if (re.test(t)) { t = t.replace(re, who); break; }
  // "sale man", "sales man" → "Salesman"
  t = t.replace(/\bsales?\s*(man|woman|person|boy|girl)\b/i, (_m, w: string) => "Sales" + w.toLowerCase()).replace(/Salesboy|Salesgirl/i, "Salesperson");
  return t.length >= 2 ? titleCase(t) : null;
}

const splitList = (s: string) =>
  s
    .split(/,|;|\n|\/| and | & |•/i)
    .map((x) => x.replace(/^[\s\-–*\d.)]+/, "").replace(/[.\s]+$/, "").trim())
    .filter((x) => x.length > 1 && x.length < 60)
    .map(cap);

export function readJobText(text: string): RoleDraft {
  const d = emptyDraft();
  const t = ` ${text.replace(/\r/g, "")} `;
  const low = t.toLowerCase();

  // Job title: "hiring a X", "need a X", "looking for 2 X", "position: X", or a short first line.
  const tm =
    t.match(/(?:position|role|job title|post)\s*[:\-–]\s*([^\n.,]{3,60})/i) ??
    t.match(/(?:hiring|need|needs|looking for|require|requires|want|wanted)\s+(?:an?\s+|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(?:new\s+|good\s+|experienced\s+|skilled\s+|full[- ]time\s+|part[- ]time\s+)?([A-Za-z][A-Za-z /&-]{2,40}?)(?:s\b)?(?=\s+(?:for|in|at|who|with|to|on|and|that|which|should|must|from|starting|urgently|asap|having)\b|\s*[,.;!\n]|\s*$)/i);
  const firstLine = text.trim().split(/\n/)[0].trim();
  if (tm) d.title = cleanTitle(tm[1]);
  // A short first line like "website developer for company" is the title; a sentence ("this job is full time…") is not.
  else if (
    firstLine.length > 2 && firstLine.length < 60 && !/[.?!]/.test(firstLine) &&
    !/\b(?:is|are|was|were|be|should|must|will|would|can|could|has|have|had|make|change|set|add|remove|salary|pay|experience|hours?|year|years|month|location)\b/i.test(firstLine.split(/\s+(?:for|in|at|with|-)\s+/i)[0])
  )
    d.title = cleanTitle(firstLine);

  // Openings: "need 5 website developer", "2 people", "3 sales executives", "two customer support officers"
  const NOT_PEOPLE = "(?:years?|yrs?|months?|days?|hours?|hrs?|weeks?|am|pm|k|thousand)";
  const on = t.match(new RegExp(`(?:hiring|need|needs|looking for|require|requires|want|wanted)\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?!${NOT_PEOPLE}\\b)[a-z]`, "i"));
  const om = on ?? t.match(new RegExp(`\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?!${NOT_PEOPLE}\\b)(?:[a-z]+\\s+){0,3}?(?!${NOT_PEOPLE}\\b)(?:people|persons|positions|posts|openings|staff|candidates|vacancies|[a-z]+s)\\b`, "i"));
  if (om) d.openings = num(om[1]);
  else if (d.title) d.openings = 1;

  // Salary: "$25,000 - $30,000", "25k to 30k a year", "$2,100 a month", "salary $28k" (£ works too)
  const sr = t.match(/[$£]?\s*(\d[\d,.]*)\s*(k|thousand)?\s*(?:-|–|to|till)\s*[$£]?\s*(\d[\d,.]*)\s*(k|thousand)?/i);
  const near = (i: number) => /salary|pay|\$|£|usd|gbp|dollars?|pounds|per (?:year|annum|month)|a (?:year|month)|annual|monthly|p\.?a\.?|k|thousand/i.test(t.slice(Math.max(0, i - 40), i + 60));
  if (sr && near(sr.index ?? 0) && !/^\s*\d{1,2}\s*(?:am|pm)/i.test(t.slice((sr.index ?? 0) + sr[0].length - 6))) {
    const a = money(sr[1], sr[2] ?? sr[4]);
    const b = money(sr[3], sr[4] ?? sr[2]);
    if (a >= 100 && b >= a) [d.salary_min, d.salary_max] = [a, b];
  }
  if (d.salary_min == null) {
    const s1 =
      t.match(/(?:salary|pay|\$|£|usd|gbp)\s*(?:is|of|:)?\s*[$£]?\s*(\d[\d,.]*)\s*(k|thousand)?/i) ??
      t.match(/(\d[\d,.]*)\s*(k|thousand)?\s*(?:dollars?|usd|pounds|gbp|per (?:year|annum|month)|a (?:year|month)|p\.?a\.?|monthly|annually)/i);
    if (s1) {
      const v = money(s1[1], s1[2]);
      if (v >= 100) d.salary_min = d.salary_max = v;
    }
  }
  if (d.salary_min != null) {
    if (/per month|a month|monthly|\/month|pcm|pm(?!\s*(?:-|–|to))/i.test(t)) d.salary_period = "month";
    else if (/per (?:year|annum)|a year|annual|annually|p\.?a\.?|\/year|yearly/i.test(t)) d.salary_period = "year";
    else d.salary_period = (d.salary_max ?? d.salary_min) >= 8000 ? "year" : "month";
  }

  // Employment and work type
  if (/part[- ]?time/.test(low)) d.employment = "Part-time";
  else if (/internship|intern\b/.test(low)) d.employment = "Internship";
  else if (/contract|freelance|temporary/.test(low)) d.employment = "Contract";
  else if (/full[- ]?time/.test(low)) d.employment = "Full-time";
  if (/hybrid/.test(low)) d.work_mode = "Hybrid";
  else if (/remote|work from home|wfh|online job/.test(low)) d.work_mode = "Remote";
  else if (/on[- ]?site|in office|office based|\boffice\b|showroom|\bshop\b|branch|factory|warehouse/.test(low)) d.work_mode = "On-site";

  // Shift and hours
  const sh = low.match(/\b(morning|evening|night|day|rotating)\s+shift/);
  if (sh) d.shift = `${cap(sh[1])} shift`;
  const hm = t.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:-|–|to|till)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))(?:[,\s]*(mon\w*[^\n.]*?\b(?:sat|fri|sun|thu)\w*))?/i);
  if (hm) d.hours = `${hm[1].replace(/\s+/g, " ")} – ${hm[2].replace(/\s+/g, " ")}${hm[3] ? `, ${cap(hm[3])}` : ""}`;

  // Place
  const city = CITIES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(t));
  if (city) d.city = city;
  const lm = t.match(/(?:office (?:is )?(?:in|at)|located (?:in|at)|location\s*[:\-–]|in)\s+([A-Z][A-Za-z0-9 .,'-]{2,50}?)(?=[.\n]|,\s*(?:salary|pay|\d)|$)/);
  if (lm && city && lm[1].includes(city) && lm[1].trim() !== city) d.location = lm[1].trim().replace(/,$/, "");
  // "our Shoreditch office", "the Canary Wharf branch"
  const area = t.match(/\b(?:our|the|a)\s+([A-Z][A-Za-z0-9 ]{2,30}?)\s+(?:office|branch|showroom|shop|store|outlet)\b/);
  if (!d.location && area && area[1] !== city) d.location = city && !area[1].includes(city) ? `${area[1]}, ${city}` : area[1];
  // "in Manchester" / "our Leeds office": a known city alone still counts as the place.
  if (!city) {
    const anyCity = t.match(/\b(?:in|at|near|our)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/);
    if (anyCity && !/^(The|Our|A|An|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(anyCity[1]) && !LANGS.includes(anyCity[1])) d.city = anyCity[1];
    // Typed in lower case: "i want it in multan", "based in lahore", "located at karachi".
    if (!d.city) {
      const low = t.match(/(?<!\b(?:experience|experienced|skilled|expert|good|degree|fluent|interested|knowledge|background|career|work|working|job|jobs|role|roles|course|diploma|certificate)\s)\b(?:in|at|near|based in|located in|located at)\s+([a-z][a-z]{2,20})(?:\s+(city))?\b/i);
      const w = low?.[1]?.toLowerCase();
      if (w && !PLACE_STOP.has(w) && !LANGS.some((l) => l.toLowerCase() === w)) d.city = titleCase(w);
    }
  }

  // Experience and languages
  // "2 years experience", "experience of 2 years", "experince should be 2 years" (typos allowed: exp…/exper…/expir…)
  // Numbers may be written as words too: "one year experience", "a year of experience", "experience should be two years".
  const N = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)";
  const ex =
    low.match(new RegExp(`\\b${N}\\s*\\+?\\s*(?:years?|yrs?)(?:\\s+of)?\\s+(?:relevant\\s+|work\\s+|working\\s+)?(?:ex[pa]\\w*)`)) ??
    low.match(new RegExp(`\\bex[pa]\\w*[^.\\d\\n]{0,30}?\\b${N}\\s*\\+?\\s*(?:years?|yrs?)\\b`)) ??
    low.match(new RegExp(`\\b(?:at least|minimum|min\\.?)\\s+${N}\\s*\\+?\\s*(?:years?|yrs?)\\b`));
  if (ex) d.min_experience = num(ex[1]);
  else if (/fresh(?:er|ers)?\b|no experience|without experience|experience not (?:needed|required)/.test(low)) d.min_experience = 0;
  d.languages = LANGS.filter((l) => new RegExp(`\\b${l}\\b`, "i").test(t));

  // Skills and duties
  const mm = t.match(/(?:must (?:have|know|be good at)|should (?:know|have)|required skills?|requirements?|skills?(?: needed)?)\s*[:\-–]?\s*([^\n.]{3,200})/i);
  if (mm) d.must_have = splitList(mm[1]).filter((s) => !/years?|experience/i.test(s)).slice(0, 6);
  const nm = t.match(/(?:nice to have|bonus|plus|preferred|good to have)\s*[:\-–]?\s*([^\n.]{3,200})/i);
  if (nm) d.nice_to_have = splitList(nm[1]).slice(0, 5);
  const dm = t.match(/(?:duties|responsibilities|will (?:need to|have to)?|tasks?)\s*[:\-–]?\s*([^\n]{3,300})/i);
  if (dm) d.duties = splitList(dm[1]).slice(0, 6);
  const dep = t.match(/(?:team|department)\s*[:\-–]\s*([^\n.,]{2,40})/i) ?? t.match(/\b(sales|marketing|customer support|support|finance|accounts|admin|hr|it|operations)\s+(?:team|department)\b/i);
  if (dep) d.department = cap(dep[1]);
  return d;
}

/** Fold the owner's answers to follow-up questions back into the draft. */
export function applyAnswers(d: RoleDraft, answers: { field: DraftField; answer: string }[]): RoleDraft {
  const out = { ...d };
  for (const { field, answer } of answers) {
    const a = answer.trim();
    if (!a) continue;
    const read = readJobText(a);
    switch (field) {
      case "title":
        out.title = cap(a);
        break;
      case "must_have":
        out.must_have = splitList(a).slice(0, 8);
        break;
      case "salary_min":
      case "salary_max": {
        const r = readJobText(`salary ${a}`);
        out.salary_min = r.salary_min;
        out.salary_max = r.salary_max;
        out.salary_period = r.salary_period;
        break;
      }
      case "openings":
        out.openings = num(a.match(/\d+|one|two|three|four|five|six|seven|eight|nine|ten/i)?.[0] ?? "") ?? out.openings;
        break;
      case "employment":
        out.employment = read.employment ?? (/full/i.test(a) ? "Full-time" : out.employment);
        break;
      case "work_mode":
        out.work_mode = read.work_mode ?? (/office|site/i.test(a) ? "On-site" : out.work_mode);
        break;
      case "location":
        out.city = read.city ?? out.city;
        out.location = cap(a);
        break;
      case "hours":
        out.hours = read.hours ?? cap(a);
        out.shift = read.shift ?? out.shift;
        break;
      case "min_experience":
        {
          // "2", "two years", "one", "a year", "none / freshers welcome"
          const w = a.toLowerCase().match(/\d+|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|a|an)\b(?=\s*(?:years?|yrs?)|\s*$)/)?.[0];
          out.min_experience = w ? num(w) : /fresh|\bno\b|none|zero|nil/i.test(a) ? 0 : null;
        }
        break;
      default:
        (out as Record<string, unknown>)[field] = a;
    }
  }
  return out;
}
