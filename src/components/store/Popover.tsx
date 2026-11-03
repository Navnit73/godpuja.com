"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A native <details> disclosure (works without JS) that also closes on Escape or a click outside once hydrated. */
export default function Popover({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => { if (el.open && !el.contains(e.target as Node)) el.open = false; };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) { el.open = false; el.querySelector("summary")?.focus(); }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, []);
  return <details ref={ref} className={className}>{children}</details>;
}
