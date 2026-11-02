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

export default function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="font-serif text-2xl font-semibold text-kumkum-900">
        God<span className="text-primary">Puja</span>
      </span>
    </span>
  );
}
