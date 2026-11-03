import Link from "next/link";
import { ChevronRight } from "./Icons";

export default function Breadcrumbs({ items, tone = "light" }: { items: { name: string; href?: string }[]; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <nav aria-label="Breadcrumb" className={`mb-4 text-sm ${dark ? "text-sandal-200" : "text-muted"}`}>
      <ol className="flex min-w-0 items-center gap-1.5 sm:flex-wrap">
        {items.map((c, i) => (
          <li key={i} className={`flex items-center gap-1.5 ${i === items.length - 1 ? "min-w-0" : "shrink-0"}`}>
            {i > 0 && <ChevronRight className={`h-3.5 w-3.5 ${dark ? "text-gold-300" : "text-sandal-400"}`} />}
            {c.href
              ? <Link href={c.href} className={dark ? "hover:text-gold-300" : "hover:text-primary"}>{c.name}</Link>
              : <span aria-current="page" className={`truncate font-medium ${dark ? "text-sandal-50" : "text-foreground"}`}>{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
