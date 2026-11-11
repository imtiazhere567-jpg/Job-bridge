"use client";

import { useActionState, useState } from "react";

type Action = (state: unknown, form: FormData) => Promise<{ error: string }>;

export function SlotPicker({ action, days, label }: { action: Action; days: { day: string; slots: { iso: string; time: string }[] }[]; label: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [picked, setPicked] = useState<string | null>(null);
  if (!days.length) return <p className="text-sm text-slate">There are no free times in the next two weeks. The clinic will contact you directly.</p>;
  return (
    <form action={formAction}>
      <div className="space-y-5">
        {days.map((d) => (
          <div key={d.day}>
            <div className="mb-2 text-sm font-semibold text-ink">{d.day}</div>
            <div className="flex flex-wrap gap-2">
              {d.slots.map((s) => (
                <label key={s.iso} className="cursor-pointer rounded-full border border-shell bg-white px-4 py-2 text-sm font-medium text-lagoon hover:border-seafoam has-[:checked]:border-lagoon has-[:checked]:bg-lagoon has-[:checked]:text-white">
                  <input type="radio" name="slot" value={s.iso} className="sr-only" onChange={() => setPicked(s.time + ", " + d.day)} required />
                  {s.time}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {state?.error && <p className="mt-4 rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">{state.error}</p>}
      <div className="sticky bottom-0 mt-6 border-t border-shell bg-white pt-4">
        <button className="btn btn-coral w-full py-3.5 text-[15px]" disabled={pending || !picked}>
          {pending ? "Booking…" : picked ? `${label}: ${picked}` : "Choose a time above"}
        </button>
      </div>
    </form>
  );
}
