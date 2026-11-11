"use client";

import { useEffect } from "react";

/** Inside the website snippet: tell the parent page how tall the content is, so the iframe grows and shrinks to fit. */
export function AutoHeight({ code }: { code: string }) {
  useEffect(() => {
    const root = document.querySelector("[data-embed-root]") as HTMLElement | null;
    if (!root) return;
    const send = () => window.parent?.postMessage({ jobbridge: code, height: Math.ceil(root.getBoundingClientRect().height) + 8 }, "*");
    send();
    const ro = new ResizeObserver(send);
    ro.observe(root);
    return () => ro.disconnect();
  }, [code]);
  return null;
}
