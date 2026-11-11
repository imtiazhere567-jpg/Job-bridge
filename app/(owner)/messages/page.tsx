import Link from "next/link";
import { AlertCircle, Mail, MessageCircle, Search } from "lucide-react";
import { Notice, PageHeader, WhatsAppLink } from "@/components/ui";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";
import { channelLive, demoMode } from "@/lib/messages";
import { ago, dayKey, fmtDateTime, fmtDay, fmtTime } from "@/lib/format";
import { demoApplicantReply, ownerReply } from "./actions";
import { ChatScroll } from "./chat-scroll";
import { Composer } from "./composer";

export const metadata = { title: "Messages" };

const KIND: Record<string, string> = {
  received: "Application received",
  invite: "Interview invite",
  booked: "Booking confirmed",
  rescheduled: "Rescheduled",
  reminder_24: "24h reminder",
  reminder_2: "2h reminder",
  no_show: "No-show follow-up",
  rejection: "Not selected",
  reply: "Your reply",
  auto_reply: "Auto-reply",
};

type Msg = { id: number; body: string; direction: string; kind: string; status: string; error: string | null; created_at: string; subject: string; to_addr: string | null };

/** Turn URLs in a message into links. */
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/\S+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part.replace(/^https?:\/\/[^/]+/, "")} target="_blank" className="break-all text-[#027EB5] underline">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Ticks({ status }: { status: string }) {
  if (status === "failed") return <AlertCircle size={13} className="text-rust" />;
  if (status === "queued" || status === "sending") return <span className="text-[#8696A0]">🕓</span>;
  return <span className={status === "sent" ? "text-[#53BDEB]" : "text-[#8696A0]"}>✓✓</span>;
}

export default async function Messages({ searchParams }: { searchParams: Promise<{ a?: string; view?: string; q?: string }> }) {
  const { a, view, q } = await searchParams;
  const { company } = await requireEmployer();
  const demo = demoMode();
  const waLive = channelLive("whatsapp");
  const emailLive = channelLive("email");

  const header = (
    <PageHeader eyebrow="Messages" title="Conversations with applicants" sub="Confirmations, invites, reminders and replies go out automatically. Reply here like you would on WhatsApp.">
      <div className="flex rounded-full border border-shell bg-white p-1 text-[13px] font-semibold">
        <Link href="/messages" className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${view !== "email" ? "bg-[#00A884] text-white" : "text-slate"}`}><MessageCircle size={14} /> WhatsApp</Link>
        <Link href="/messages?view=email" className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${view === "email" ? "bg-lagoon text-white" : "text-slate"}`}><Mail size={14} /> Email</Link>
      </div>
    </PageHeader>
  );

  const status = (
    <div className="mb-5">
      {demo ? (
        <Notice>
          <b>Demo mode.</b> Messages are shown here and nothing is sent to real phones. When the clinic goes live, set <code>DEMO_MODE=off</code> and add the WhatsApp and email keys in Vercel. The same flow then sends for real.
        </Notice>
      ) : (
        <Notice tone={waLive && emailLive ? "ok" : "warn"}>
          <b>Live mode.</b> WhatsApp: {waLive ? "connected" : "not connected (messages stay in the app)"} · Email: {emailLive ? "connected" : "not connected"}
        </Notice>
      )}
    </div>
  );

  if (view === "email") {
    const emails = await db.q<Msg & { name: string; applicant_id: number }>(
      "select m.*, a.name from messages m join applicants a on a.id = m.applicant_id join roles r on r.id = a.role_id where r.company_id = $1 and m.channel = 'email' order by m.created_at desc, m.id desc limit 150",
      [company.id],
    );
    return (
      <>
        {header}
        {status}
        <div className="space-y-3">
          {emails.map((m) => (
            <details key={m.id} className="card overflow-hidden">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5">
                <Mail size={15} className="text-lagoon" />
                <span className="font-semibold">{m.name}</span>
                <span className="flex-1 truncate text-sm text-slate">{m.subject}</span>
                <span className="chip bg-pearl text-slate">{m.status === "demo" ? "Demo" : m.status}</span>
                <span className="text-[12px] text-slate">{fmtDateTime(m.created_at)}</span>
              </summary>
              <div className="border-t border-shell bg-pearl px-5 py-4 text-[14px] leading-relaxed whitespace-pre-line">
                <div className="mb-2 text-[12px] text-slate">To: {m.to_addr ?? "no address"}</div>
                <Linked text={m.body} />
                {m.error && <div className="mt-2 text-[12px] text-rust">{m.error}</div>}
              </div>
            </details>
          ))}
          {emails.length === 0 && <p className="card p-8 text-center text-sm text-slate">No emails yet.</p>}
        </div>
      </>
    );
  }

  const chats = await db.q<{ id: number; slug: string; name: string; phone: string; title: string; last_body: string; last_dir: string; last_at: string; unread: number }>(
    `select a.id, a.slug, a.name, a.phone, r.title, m.body as last_body, m.direction as last_dir, m.created_at as last_at,
       (select count(*)::int from messages x where x.applicant_id = a.id and x.channel = 'whatsapp' and x.direction = 'in'
          and x.created_at > coalesce((select max(y.created_at) from messages y where y.applicant_id = a.id and y.channel = 'whatsapp' and y.direction = 'out'), 'epoch')) as unread
     from applicants a join roles r on r.id = a.role_id
     join lateral (select body, direction, created_at, id from messages where applicant_id = a.id and channel = 'whatsapp' order by created_at desc, id desc limit 1) m on true
     where r.company_id = $1 ${q ? "and (a.name ilike $2 or a.phone ilike $2)" : ""}
     order by m.created_at desc, m.id desc limit 120`,
    q ? [company.id, `%${q}%`] : [company.id],
  );
  const current = chats.find((c) => c.slug === a || c.id === Number(a)) ?? chats[0];
  const thread = current
    ? await db.q<Msg>("select * from messages where applicant_id = $1 and channel = 'whatsapp' order by created_at, id", [current.id])
    : [];

  return (
    <>
      {header}
      {status}
      <div className="grid h-[calc(100vh-260px)] min-h-[560px] overflow-hidden rounded-[14px] border border-shell bg-white lg:grid-cols-[340px_1fr]">
        <aside className={`flex min-h-0 flex-col border-r border-shell ${a ? "hidden lg:flex" : "flex"}`}>
          <form className="border-b border-shell p-3" action="/messages">
            <div className="flex items-center gap-2 rounded-lg bg-[#F0F2F5] px-3 py-2">
              <Search size={15} className="text-slate" />
              <input name="q" defaultValue={q} placeholder="Search name or number" className="w-full bg-transparent text-sm outline-none" />
            </div>
          </form>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {chats.map((c) => (
              <li key={c.id}>
                <Link href={`/messages?a=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`flex gap-3 border-b border-shell/60 px-4 py-3 ${current?.id === c.id ? "bg-[#F0F2F5]" : "hover:bg-pearl"}`}>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint font-semibold text-lagoon">{c.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-ink">{c.name}</span>
                      <span className={`shrink-0 text-[11.5px] ${c.unread ? "font-semibold text-[#00A884]" : "text-slate"}`}>{ago(c.last_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] text-slate">{c.last_dir === "out" ? "You: " : ""}{c.last_body.replace(/\s+/g, " ")}</span>
                      {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#00A884] px-1.5 text-[11px] font-bold text-white">{c.unread}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {chats.length === 0 && <li className="p-8 text-center text-sm text-slate">No conversations yet.</li>}
          </ul>
        </aside>

        {current ? (
          <section className={`min-h-0 flex-col ${a ? "flex" : "hidden lg:flex"}`}>
            <header className="flex items-center gap-3 border-b border-shell bg-[#F0F2F5] px-4 py-2.5">
              <Link href="/messages" className="text-sm text-slate lg:hidden">←</Link>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-mint font-semibold text-lagoon">{current.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{current.name}</div>
                <div className="truncate text-[12px] text-slate">{current.phone} · {current.title}</div>
              </div>
              <WhatsAppLink phone={current.phone} label="Open in WhatsApp" />
              <Link href={`/applicants/${current.slug}?from=messages:${current.slug}`} className="btn btn-ghost px-3 py-1.5 text-[12.5px]">Profile</Link>
            </header>
            <ChatScroll
              count={thread.length + current.id}
              className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-4 sm:px-10"
              style={{ background: "#EFEAE2", backgroundImage: "radial-gradient(rgba(6,59,103,0.06) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
            >
              {thread.map((m, i) => {
                const newDay = i === 0 || dayKey(new Date(thread[i - 1].created_at)) !== dayKey(new Date(m.created_at));
                const out = m.direction === "out";
                return (
                  <div key={m.id}>
                    {newDay && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-lg bg-white px-3 py-1 text-[12px] text-slate shadow-sm">{fmtDay(m.created_at)}</span>
                      </div>
                    )}
                    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-lg px-3 pt-1.5 pb-1 text-[14px] leading-snug shadow-sm ${out ? "rounded-tr-none bg-[#D9FDD3]" : "rounded-tl-none bg-white"}`}>
                        {out && KIND[m.kind] && <div className="mb-0.5 text-[11px] font-semibold text-seafoam-dark">{KIND[m.kind]}</div>}
                        <div className="whitespace-pre-line text-ink"><Linked text={m.body} /></div>
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
                          {fmtTime(m.created_at)} {out && <Ticks status={m.status} />}
                        </div>
                        {m.error && <div className="text-[11px] text-rust">Not delivered: {m.error}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </ChatScroll>
            <Composer reply={ownerReply.bind(null, current.id)} asApplicant={demo ? demoApplicantReply.bind(null, current.id) : undefined} name={current.name} />
          </section>
        ) : (
          <section className="hidden place-items-center bg-pearl text-sm text-slate lg:grid">Choose a conversation</section>
        )}
      </div>
    </>
  );
}
