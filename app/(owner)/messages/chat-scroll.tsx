"use client";

import { useLayoutEffect, useRef } from "react";

/** Chat body that opens at the newest message, like WhatsApp. */
export function ChatScroll({ children, count, className, style }: { children: React.ReactNode; count: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [count]);
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
