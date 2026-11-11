"use client";

import { useEffect } from "react";

/** Start a page at the top (used after creating a job, so the new page doesn't open half-way down). */
export function ScrollTop() {
  useEffect(() => {
    // Once now and once after the page has settled, in case the browser restores the old scroll position.
    window.scrollTo({ top: 0 });
    const t = setTimeout(() => window.scrollTo({ top: 0 }), 120);
    return () => clearTimeout(t);
  }, []);
  return null;
}
