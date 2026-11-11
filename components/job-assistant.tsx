"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Bot, Check, FileText, HelpCircle, RefreshCw, Send, Sparkles } from "lucide-react";
import { assistantTurn, type AssistantReply } from "@/app/(owner)/roles/actions";
import type { DraftQuestion, RoleDraft } from "@/lib/role-draft";

const LABELS: Record<string, string> = {
  title: "Job title", department: "Team", employment: "Full or part time", work_mode: "Work type", shift: "Shift", hours: "Hours",
  salary_min: "Salary from", salary_max: "Salary up to", salary_period: "Pay period", location: "Area", city: "City", openings: "Number of people", start_date: "Start date",
  duties: "Main duties", must_have: "Must-have skills", nice_to_have: "Nice-to-have skills", languages: "Languages", min_experience: "Experience", notes: "Notes",
};
const EXAMPLE =
  "We need 2 website developers for our Shoreditch office in London. Full-time, 9 am to 5:30 pm, Monday to Friday. Salary $35,000 to $45,000 a year. Must know HTML, CSS, JavaScript and React. At least 2 years of experience.";

// ---------- shared between the assistant and the Job description box ----------
/** Form fields the owner typed in or the assistant filled. Untouched defaults don't count as answers. */
const touched = new Set<string>();
/** True once the owner edits the description by hand: the assistant then stops rewriting it on its own. */
let descEditedByHand = false;

const roleForm = () => document.getElementById("role-form") as HTMLFormElement | null;
const descBox = () => document.getElementById("job-description") as HTMLTextAreaElement | null;

function putDescription(text: string) {
  const el = descBox();
  if (!el) return;
  el.value = text;
  el.style.backgroundColor = "#EEF6FD";
  setTimeout(() => (el.style.backgroundColor = ""), 1600);
  descEditedByHand = false;
  el.dispatchEvent(new CustomEvent("jb-written"));
}

/** Fill the form's fields from a draft; returns the names of the fields that were filled. */
function fillForm(form: HTMLFormElement, d: RoleDraft) {
  const filled: string[] = [];
  const mark = (el: HTMLElement) => {
    el.style.backgroundColor = "#EEF6FD";
    el.style.borderColor = "#3A9BE8";
    el.addEventListener("input", () => { el.style.backgroundColor = ""; el.style.borderColor = ""; }, { once: true });
  };
  const setVal = (name: string, v: string | number | null | undefined) => {
    if (v == null || v === "") return;
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el || !("value" in el)) return;
    el.value = String(v);
    mark(el);
    filled.push(name);
  };
  const setRadio = (name: string, v: string | null) => {
    if (!v) return;
    const el = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${v}"]`);
    if (el) {
      if (!el.checked) el.click(); // a click keeps the form's own state in step (the pay switch)
      filled.push(name);
    }
  };
  setVal("title", d.title);
  setVal("department", d.department);
  setRadio("employment", d.employment);
  setRadio("work_mode", d.work_mode);
  setVal("shift", d.shift);
  setVal("hours", d.hours);
  setRadio("salary_period", d.salary_period);
  setVal("salary_min", d.salary_min ? d.salary_min.toLocaleString("en-GB") : null);
  setVal("salary_max", d.salary_max ? d.salary_max.toLocaleString("en-GB") : null);
  setVal("location", d.location);
  setVal("city", d.city);
  setVal("openings", d.openings);
  setVal("start_date", d.start_date && /^\d{4}-\d{2}-\d{2}$/.test(d.start_date) ? d.start_date : null);
  setVal("duties", d.duties.join("\n"));
  setVal("must_have", d.must_have.join("\n"));
  setVal("nice_to_have", d.nice_to_have.join("\n"));
  setVal("languages", d.languages.join(", "));
  setVal("min_experience", d.min_experience);
  setVal("notes", d.notes);
  filled.forEach((f) => touched.add(f));
  return filled;
}

type Msg = { from: "you" | "bot"; text: string; filled?: string[]; suggested?: string[]; questions?: DraftQuestion[]; wrote?: boolean; by?: AssistantReply["by"] };

/** The New job assistant: describe the job, it fills the form, asks what's missing, writes the description and makes changes on request. */
export function JobAssistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<{ field: string; question: string; answer: string }[]>([]);
  const [current, setCurrent] = useState<Record<string, string>>({});
  const [skip, setSkip] = useState<string[]>([]);
  const thread = useRef<HTMLDivElement>(null);

  // Remember which fields the owner fills in by hand.
  useEffect(() => {
    const form = roleForm();
    if (!form) return;
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (!el?.name) return;
      if (el.name === "description") descEditedByHand = true;
      else touched.add(el.name);
    };
    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    return () => {
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
    };
  }, []);
  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text: string, nextAnswers = answers, nextSkip = skip) => {
    const form = roleForm();
    if (!form || busy) return;
    const t = text.trim();
    if (!t && !nextAnswers.length) return;
    if (t) setMsgs((m) => [...m, { from: "you", text: t }]);
    setInput("");
    setBusy(true);
    try {
      const desc = descBox()?.value.trim() ?? "";
      const r = await assistantTurn(t, new FormData(form), [...touched], nextAnswers, nextSkip, !desc || !descEditedByHand);
      const filled = r.draft ? fillForm(form, r.draft) : [];
      for (const name of r.clear ?? []) {
        const el = form.elements.namedItem(name) as HTMLTextAreaElement | HTMLInputElement | null;
        if (el && "value" in el) el.value = "";
        touched.delete(name);
      }
      if (r.description) putDescription(r.description);
      setMsgs((m) => [...m, { from: "bot", text: r.note, filled, suggested: r.suggested, questions: r.questions, wrote: !!r.description, by: r.by }]);
      setCurrent({});
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "Something went wrong. Please try again." }]);
    }
    setBusy(false);
  };
  const submitAnswers = (qs: DraftQuestion[]) => {
    const fresh = qs.filter((q) => current[q.field]?.trim()).map((q) => ({ field: q.field, question: q.question, answer: current[q.field].trim() }));
    if (!fresh.length) return;
    const merged = [...answers.filter((a) => !fresh.some((f) => f.field === a.field)), ...fresh];
    setAnswers(merged);
    setMsgs((m) => [...m, { from: "you", text: fresh.map((f) => f.answer).join(" · ") }]);
    send("", merged, skip);
  };
  const skipQ = (field: string) => {
    const s = [...skip, field];
    setSkip(s);
    setMsgs((m) => m.map((x, i) => (i === m.length - 1 && x.questions ? { ...x, questions: x.questions.filter((q) => q.field !== field) } : x)));
  };
  const last = msgs[msgs.length - 1];

  return (
    <section className="card overflow-hidden border-coral/30">
      <div className="bridge-gradient flex flex-wrap items-center gap-3 px-6 py-4 text-white">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Bot size={20} /></span>
        <div className="min-w-[220px] flex-1">
          <h2 className="font-display text-[17px] font-extrabold">Job assistant</h2>
          <p className="text-[12.5px] text-white/75">Tell it about the job: it fills the form, asks what&apos;s missing and writes the job description. Ask for changes any time.</p>
        </div>
      </div>

      <div ref={thread} className="max-h-[420px] space-y-3 overflow-y-auto bg-pearl/40 px-5 py-5">
        <Bubble from="bot">
          Hi! Describe the job the way you&apos;d tell a colleague, for example <i>&ldquo;I need a website developer in London, full-time, $40k a year&rdquo;</i>. I&apos;ll fill everything in below and write the job description.
          <span className="mt-1.5 block text-slate">Already filled the form yourself? Just say <b>&ldquo;write the description&rdquo;</b>. Want a change? Say <b>&ldquo;make it remote&rdquo;</b> or <b>&ldquo;salary 40k to 50k&rdquo;</b>.</span>
        </Bubble>
        {msgs.map((m, i) => (
          <Bubble key={i} from={m.from}>
            {m.text}
            {m.filled && m.filled.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...new Set(m.filled)].map((f) => <span key={f} className="chip border border-shell bg-white text-[11px] text-lagoon"><Check size={11} /> {LABELS[f] ?? f}</span>)}
              </div>
            )}
            {!!m.suggested?.length && (
              <p className="mt-2 text-[12.5px] text-amber"><b>Suggested from the job title:</b> {m.suggested.map((f) => LABELS[f] ?? f).join(", ")}. Please check them.</p>
            )}
            {m.wrote && (
              <button type="button" onClick={() => descBox()?.scrollIntoView({ behavior: "smooth", block: "center" })} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[12px] font-semibold text-lagoon shadow-sm hover:text-coral">
                <ArrowDown size={13} /> See the job description
              </button>
            )}
            {m === last && m.questions && m.questions.length > 0 && (
              <div className="mt-3 space-y-2.5 rounded-xl border border-coral/25 bg-white p-3">
                <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-lagoon"><HelpCircle size={14} className="text-coral" /> Answer what you can:</div>
                {m.questions.map((q) => (
                  <div key={q.field}>
                    <label className="flex items-baseline justify-between gap-3 text-[13px] font-semibold text-ink">
                      {q.question}
                      <button type="button" onClick={() => skipQ(q.field)} className="shrink-0 text-[11.5px] font-semibold text-slate hover:text-coral">Skip</button>
                    </label>
                    <input
                      value={current[q.field] ?? ""}
                      onChange={(e) => setCurrent((c) => ({ ...c, [q.field]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitAnswers(m.questions!); } }}
                      className="field mt-1 py-1.5 text-[13px]"
                      placeholder="Type your answer"
                    />
                  </div>
                ))}
                <button type="button" onClick={() => submitAnswers(m.questions!)} disabled={busy || !m.questions.some((q) => current[q.field]?.trim())} className="btn btn-primary px-3.5 py-1.5 text-[13px] disabled:opacity-40">
                  <Check size={14} /> Add my answers
                </button>
              </div>
            )}
          </Bubble>
        ))}
        {busy && <Bubble from="bot"><span className="inline-flex items-center gap-2 text-slate"><Sparkles size={14} className="animate-pulse text-coral" /> Working on it…</span></Bubble>}
      </div>

      <div className="border-t border-shell p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={2}
            className="field min-h-[52px] flex-1 resize-y text-[14px]"
            placeholder="Describe the job, ask for a change, or say “write the description”…"
            aria-label="Message the job assistant"
          />
          <button type="button" onClick={() => send(input)} disabled={busy || !input.trim()} className="btn btn-primary h-[52px] px-4 disabled:opacity-40" aria-label="Send">
            <Send size={16} />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => send("Write the job description")} disabled={busy} className="chip border border-shell bg-white text-lagoon hover:border-coral disabled:opacity-40"><FileText size={12} /> Write the job description</button>
          {!msgs.length && <button type="button" onClick={() => setInput(EXAMPLE)} className="chip border border-shell bg-white text-lagoon hover:border-coral">Use an example</button>}
          {last?.by && <span className="chip ml-auto bg-mint text-[11px] text-lagoon">{last.by === "claude" ? "Claude" : "Built-in assistant (connect AI for smarter replies)"}</span>}
        </div>
      </div>
    </section>
  );
}

function Bubble({ from, children }: { from: "you" | "bot"; children: React.ReactNode }) {
  return from === "you" ? (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-lagoon px-4 py-2.5 text-[13.5px] whitespace-pre-line text-white">{children}</div>
    </div>
  ) : (
    <div className="flex items-start gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-lagoon shadow-sm"><Bot size={16} /></span>
      <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-shell bg-white px-4 py-2.5 text-[13.5px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

/** Step 6 on the New job page: the job description, written by the assistant and editable. */
export function DescriptionField() {
  const [busy, setBusy] = useState(false);
  const [has, setHas] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    const el = descBox();
    if (!el) return;
    const on = () => setHas(!!el.value.trim());
    el.addEventListener("input", on);
    el.addEventListener("jb-written", on);
    return () => {
      el.removeEventListener("input", on);
      el.removeEventListener("jb-written", on);
    };
  }, []);
  const write = async () => {
    const form = roleForm();
    if (!form) return;
    setBusy(true);
    setNote("");
    try {
      const r = await assistantTurn("Write the job description", new FormData(form), [...touched], [], [], true);
      if (r.description) putDescription(r.description);
      else setNote(r.note);
    } catch {
      setNote("Something went wrong. Please try again.");
    }
    setBusy(false);
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={write} disabled={busy} className="btn btn-ghost px-3.5 py-1.5 text-[13px] disabled:opacity-50">
          {has ? <RefreshCw size={14} /> : <Sparkles size={14} />} {busy ? "Writing…" : has ? "Write it again" : "Write it for me"}
        </button>
        <span className="text-[12px] text-slate">{note || "Uses the details in the form. Edit the text freely; your version is the one saved."}</span>
      </div>
      <textarea
        id="job-description"
        name="description"
        rows={16}
        className="field font-[inherit] text-[14px] leading-relaxed"
        placeholder={"Ask the assistant at the top, or press “Write it for me”.\nLeave it empty and the description is written for you when you create the job."}
      />
      <p className="mt-1.5 text-[12px] text-slate">Lines starting with &ldquo;- &rdquo; become bullet points. Short lines on their own become headings.</p>
    </div>
  );
}
