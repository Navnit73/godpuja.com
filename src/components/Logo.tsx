export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  const petal = "M32 12c6 8 6 20 0 31-6-11-6-23 0-31z";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--color-saffron-600)" />
      <g fill="var(--color-sandal-50)">
        <path d={petal} />
        <path d={petal} transform="rotate(-38 32 46)" opacity=".92" />
        <path d={petal} transform="rotate(38 32 46)" opacity=".92" />
        <path d={petal} transform="rotate(-72 32 46)" opacity=".8" />
        <path d={petal} transform="rotate(72 32 46)" opacity=".8" />
      </g>
      <path d="M14 50c10 5 26 5 36 0" stroke="var(--color-gold-300)" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** `tone="light"` is for dark surfaces (footer). */
/** `compact`: slightly smaller below the `xs` breakpoint (site header on 320px phones). */
export default function Logo({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center ${compact ? "gap-2 xs:gap-2.5" : "gap-2.5"}`}>
      <LogoMark className={compact ? "h-8 w-8 xs:h-9 xs:w-9" : undefined} />
      <span className={`font-serif font-semibold ${compact ? "text-xl xs:text-2xl" : "text-2xl"} ${tone === "light" ? "text-sandal-50" : "text-kumkum-900"}`}>
        God<span className={tone === "light" ? "text-gold-300" : "text-primary"}>Puja</span>
      </span>
    </span>
  );
}
