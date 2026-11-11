"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";

type Action = (state: unknown, form: FormData) => Promise<{ error: string } | undefined>;

/** For CVs that arrive by email, WhatsApp or in person. */
export function AddApplicant({ action }: { action: Action }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost h-full min-h-[56px]">
        <UserPlus size={16} /> Add a CV you received
      </button>
    );
  return (
    <form action={formAction} className="card w-full space-y-3 p-4 md:w-[360px]">
      <div className="text-sm font-semibold text-ink">Add a CV received by email or in person</div>
      <input name="name" required placeholder="Full name" className="field" />
      <div className="grid grid-cols-2 gap-2">
        <input name="phone" placeholder="Phone" className="field" />
        <input name="email" type="email" placeholder="Email" className="field" />
      </div>
      <select name="source" className="field" defaultValue="email">
        <option value="email">Received by email</option>
        <option value="whatsapp">Received on WhatsApp</option>
        <option value="manual">Walk-in / in person</option>
        <option value="indeed">Indeed / Reed / Totaljobs</option>
      </select>
      <input type="file" name="cv" required accept=".pdf,.docx,.txt" className="block w-full text-sm text-slate file:mr-3 file:rounded-full file:border-0 file:bg-mint file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-lagoon" />
      {state?.error && <p className="text-sm text-rust">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Reading CV…" : "Add & score"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
