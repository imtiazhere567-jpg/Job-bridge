import { descriptionBlocks } from "@/lib/jobpost";

/**
 * A job description, nicely laid out: the "We're Hiring" title, the key facts
 * (Company, Position, Job Type…) as a small table, headings, paragraphs and bullet lists.
 */
/** `body`: leave out the title and key facts (pages that already show them in their own header). */
export function JobDescription({ text, className = "", body = false }: { text: string; className?: string; body?: boolean }) {
  return (
    <div className={`prose-calla text-ink ${className}`}>
      {descriptionBlocks(text).filter((b) => !body || (b.type !== "title" && b.type !== "facts")).map((b, i) =>
        b.type === "title" ? (
          <h2 key={i} className="!mt-0 font-display text-[22px] font-extrabold text-lagoon">{b.text}</h2>
        ) : b.type === "facts" ? (
          <dl key={i} className="not-prose my-4 grid gap-x-6 gap-y-1.5 rounded-2xl border border-shell bg-pearl/60 px-4 py-3 sm:grid-cols-2">
            {b.facts!.map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[14px]">
                <dt className="shrink-0 font-bold text-lagoon">{k}:</dt>
                <dd className="m-0 text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        ) : b.type === "h" ? (
          <h3 key={i}>{b.text}</h3>
        ) : b.type === "p" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i}>{b.items!.map((it, k) => <li key={k}>{it}</li>)}</ul>
        ),
      )}
    </div>
  );
}
