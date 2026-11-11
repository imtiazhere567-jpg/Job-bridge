"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

/** Grid / List switch. The choice is kept in a cookie, so the page opens the same way next time. */
export function ViewToggle({ name, value }: { name: string; value: "grid" | "list" }) {
  const router = useRouter();
  const pick = (v: "grid" | "list") => {
    if (v === value) return;
    document.cookie = `${name}=${v}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  const btn = (v: "grid" | "list", Icon: typeof List, label: string) => (
    <button
      type="button"
      onClick={() => pick(v)}
      aria-pressed={value === v}
      title={`${label} view`}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold ${value === v ? "bg-white text-lagoon shadow-[0_1px_4px_rgba(6,59,103,0.15)]" : "text-slate hover:text-lagoon"}`}
    >
      <Icon size={15} /> {label}
    </button>
  );
  return (
    <div className="flex rounded-xl bg-pearl p-1" role="group" aria-label="Change view">
      {btn("grid", LayoutGrid, "Grid")}
      {btn("list", List, "List")}
    </div>
  );
}
