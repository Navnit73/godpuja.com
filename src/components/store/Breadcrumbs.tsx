import Link from "next/link";

export default function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href ? <Link href={c.href} className="hover:text-primary">{c.name}</Link> : <span aria-current="page" className="font-medium text-foreground">{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
