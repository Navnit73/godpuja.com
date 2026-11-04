import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import PageBand from "@/components/store/PageBand";
import VidhiCardView from "@/components/store/VidhiCardView";
import { env } from "@/server/env";
import { getPublicVidhiList } from "@/server/public/vidhi";
import { publicVidhiSchema, VIDHI_BASE, VIDHI_CATEGORIES } from "@/lib/validation/vidhi";

type Props = PageProps<"/pooja-vidhi">;
const parse = async (searchParams: Props["searchParams"]) => {
  const raw = await searchParams;
  const pick = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const r = publicVidhiSchema.safeParse({ category: pick("category"), page: pick("page") });
  return r.success ? r.data : publicVidhiSchema.parse({}); // a bad parameter shows the plain list instead of an error
};
const href = (category?: string, page = 1) => {
  const p = new URLSearchParams();
  if (category) p.set("category", category);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return `${VIDHI_BASE}${s ? `?${s}` : ""}`;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  await connection();
  const q = await parse(searchParams);
  const label = VIDHI_CATEGORIES.find((c) => c.key === q.category)?.label;
  const title = label ? `${label} guides` : "Pooja Vidhi";
  const description = "Step-by-step pooja guides: daily and festival pooja, vrat and katha, with the samagri you need, the steps and the mantras.";
  const canonical = `${env().SITE_URL.replace(/\/$/, "")}${href(q.category, q.page)}`;
  return { title: q.page > 1 ? `${title} — page ${q.page}` : title, description, alternates: { canonical }, openGraph: { type: "website", title, description, url: canonical } };
}

async function Content({ searchParams }: Props) {
  await connection();
  const q = await parse(searchParams);
  const r = await getPublicVidhiList(q.category, q.page, q.limit);
  const total = Object.values(r.counts).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <PageBand title="Pooja Vidhi" description="Learn each pooja step by step: what you need, how to prepare, the order of the steps and the mantras." crumbs={[{ name: "Home", href: "/" }, { name: "Pooja Vidhi" }]} />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {total > 0 && (
          <nav aria-label="Guide categories" className="mb-6">
            <ul className="flex flex-wrap gap-2">
              <li><Link href={href()} aria-current={!q.category ? "true" : undefined} className={`chip ${!q.category ? "border-primary text-primary" : ""}`}>All ({total})</Link></li>
              {VIDHI_CATEGORIES.filter((c) => (r.counts[c.key] ?? 0) > 0).map((c) => (
                <li key={c.key}><Link href={href(c.key)} aria-current={q.category === c.key ? "true" : undefined} className={`chip ${q.category === c.key ? "border-primary text-primary" : ""}`}>{c.label} ({r.counts[c.key]})</Link></li>
              ))}
            </ul>
          </nav>
        )}
        {r.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sandal-300 bg-surface px-6 py-16 text-center">
            <p className="text-lg font-semibold">{total === 0 ? "Guides are coming soon" : "No guides in this category yet"}</p>
            {q.category && total > 0 && <Link href={href()} className="btn-outline mt-5">See all guides</Link>}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{r.items.map((v) => <VidhiCardView key={v.id} v={v} />)}</ul>
        )}
        {r.pages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3 border-t border-sandal-200 pt-6 text-sm">
            {r.page > 1 ? <Link rel="prev" className="btn-outline btn-sm" href={href(q.category, r.page - 1)}>Previous</Link> : <span />}
            <p className="text-muted">Page <span className="font-semibold text-foreground">{r.page}</span> of {r.pages}</p>
            {r.page < r.pages ? <Link rel="next" className="btn-outline btn-sm" href={href(q.category, r.page + 1)}>Next</Link> : <span />}
          </nav>
        )}
      </div>
    </main>
  );
}

export default function VidhiIndexPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
