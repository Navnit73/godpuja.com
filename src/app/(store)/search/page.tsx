import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import DevotionalCardView from "@/components/store/DevotionalCardView";
import PostCard from "@/components/store/PostCard";
import VidhiCardView from "@/components/store/VidhiCardView";
import PageBand from "@/components/store/PageBand";
import ProductListing from "@/components/store/ProductListing";
import { parseListing } from "@/lib/listing";
import { findFacets, findPublicProducts } from "@/server/services/products";
import { cleanQuery, contentCounts } from "@/server/services/search";
import { findPublicDevotionalList } from "@/server/services/devotional";
import { findPublicPosts } from "@/server/services/pages";
import { findPublicVidhiList } from "@/server/services/vidhi";
import { DEVOTIONAL_TYPE_KEYS } from "@/lib/validation/devotional";
import { ApiError } from "@/server/api";
import { clientIpFromHeaders, rateLimit } from "@/server/rate-limit";

// Full-text search is the most expensive public query; cap it per client (per instance, see server/rate-limit.ts).
const SEARCH_LIMIT = 30;
function searchAllowed(h: Headers) {
  try {
    rateLimit(`search:${clientIpFromHeaders(h)}`, SEARCH_LIMIT, 60_000);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.code === "RATE_LIMITED") return false;
    throw err;
  }
}

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } }; // result pages are not indexed

type Props = PageProps<"/search">;

const TABS = [["", "Everything"], ["vidhi", "Pooja Vidhi"], ["devotional", "Aarti & Mantras"], ["posts", "Blog & guides"]] as const;
type Tab = (typeof TABS)[number][0];
const tabHref = (q: string, tab: Tab, page = 1) => `/search?q=${encodeURIComponent(q)}${tab ? `&in=${tab}` : ""}${page > 1 ? `&page=${page}` : ""}`;
const PER = 12;

function Section({ title, total, tabKey, text, children }: { title: string; total: number; tabKey: Tab; text: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`s-${tabKey}`} className="mb-10">
      <div className="mb-4 flex items-end justify-between gap-3"><h2 id={`s-${tabKey}`} className="font-sans text-xl font-semibold">{title} <span className="text-sm font-normal text-muted">({total})</span></h2>
        {total > 3 && <Link href={tabHref(text, tabKey)} className="text-sm text-primary underline">See all {total}</Link>}</div>
      {children}
    </section>
  );
}

async function Content({ searchParams }: Props) {
  await connection();
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim() : "";
  const tab: Tab = raw.in === "vidhi" || raw.in === "devotional" || raw.in === "posts" ? raw.in : "";
  const page = Math.max(1, Math.min(500, Number(raw.page) || 1));
  const query = parseListing(raw);
  const allowed = !query.q || searchAllowed(await headers());
  const text = cleanQuery(query.q ?? "");
  const active = !!query.q && allowed;

  // Products: exact full-text search first; if that finds nothing, partial words ("gane" finds "Ganesha").
  let partial = false;
  let products = active && !tab ? await findPublicProducts(query) : null;
  if (products && products.total === 0) { const alt = await findPublicProducts(query, { partial: true }); if (alt.total > 0) { products = alt; partial = true; } }
  const facets = active && !tab && products ? await findFacets(query, { partial }) : undefined;
  const counts = active ? await contentCounts(text) : { vidhi: 0, devotional: 0, posts: 0 };
  const preview = active && !tab ? await Promise.all([
    counts.vidhi ? findPublicVidhiList({ q: text, limit: 3 }) : null,
    counts.devotional ? findPublicDevotionalList({ types: DEVOTIONAL_TYPE_KEYS, q: text, limit: 3 }) : null,
    counts.posts ? findPublicPosts("all", { q: text, limit: 3 }) : null,
  ]) : null;
  const full = active && tab
    ? tab === "vidhi" ? await findPublicVidhiList({ q: text, page, limit: PER })
    : tab === "devotional" ? await findPublicDevotionalList({ types: DEVOTIONAL_TYPE_KEYS, q: text, page, limit: PER })
    : await findPublicPosts("all", { q: text, page, limit: PER })
    : null;
  const nothing = active && !tab && (products?.total ?? 0) === 0 && counts.vidhi + counts.devotional + counts.posts === 0;
  const countOf = (t: Tab) => (t === "vidhi" ? counts.vidhi : t === "devotional" ? counts.devotional : t === "posts" ? counts.posts : null);
  const pages = full ? full.pages : 1;

  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <PageBand title={query.q ? `Results for “${query.q}”` : "Search"} crumbs={[{ name: "Home", href: "/" }, { name: "Search" }]}>
        <form method="get" action="/search" role="search" aria-label="Search the site" className="mt-5 flex max-w-xl gap-2">
          <label htmlFor="q" className="sr-only">Search products, guides, aarti and mantras</label>
          <input id="q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Search products, guides, aarti, mantras…" className="input h-11 flex-1 rounded-full pl-5" />
          {tab && <input type="hidden" name="in" value={tab} />}
          <button type="submit" className="btn-primary">Search</button>
        </form>
      </PageBand>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {active && (
          <nav aria-label="Result types" className="mb-6"><ul className="flex flex-wrap gap-2">
            {TABS.map(([k, label]) => {
              const n = countOf(k);
              return <li key={k || "all"}><Link href={tabHref(text, k)} aria-current={tab === k ? "page" : undefined} className={`chip ${tab === k ? "border-primary text-primary" : ""}`}>{label}{n !== null && ` (${n})`}</Link></li>;
            })}
          </ul></nav>
        )}
        {!allowed ? <p className="text-muted" role="status">Too many searches in a short time. Please wait a minute and try again.</p>
        : !query.q ? <p className="text-muted">{q.length === 1 ? "Type at least 2 characters to search." : "Enter a word to search products, Pooja Vidhi guides, aarti, mantras and the blog."}</p>
        : nothing ? (
          <div className="rounded-2xl border border-dashed border-sandal-300 bg-surface px-6 py-12 text-center" role="status">
            <p className="text-lg font-semibold">Nothing found for “{text}”</p>
            <p className="mt-2 text-muted">Check the spelling, try fewer or simpler words, or browse:</p>
            <p className="mt-5 flex flex-wrap justify-center gap-2">
              {[["Shop", "/shop"], ["Pooja Vidhi", "/pooja-vidhi"], ["Aarti", "/aarti"], ["Mantras", "/mantras"], ["Blog", "/blog"]].map(([l, h]) => <Link key={h} href={h} className="chip">{l}</Link>)}
            </p>
          </div>
        )
        : tab ? (
          <>
            {full && (full as { items: unknown[] }).items.length === 0 ? <p className="text-muted">No results in this section.</p> : (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {tab === "vidhi" && (full as Awaited<ReturnType<typeof findPublicVidhiList>>).items.map((v) => <VidhiCardView key={v.id} v={v} />)}
                {tab === "devotional" && (full as Awaited<ReturnType<typeof findPublicDevotionalList>>).items.map((d) => <DevotionalCardView key={d.id} d={d} />)}
                {tab === "posts" && (full as Awaited<ReturnType<typeof findPublicPosts>>).items.map((p) => <PostCard key={p.id} p={p} showKind />)}
              </ul>
            )}
            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3 border-t border-sandal-200 pt-6 text-sm">
                {page > 1 ? <Link rel="prev" className="btn-outline btn-sm" href={tabHref(text, tab, page - 1)}>Previous</Link> : <span />}
                <p className="text-muted">Page {page} of {pages}</p>
                {page < pages ? <Link rel="next" className="btn-outline btn-sm" href={tabHref(text, tab, page + 1)}>Next</Link> : <span />}
              </nav>
            )}
          </>
        ) : (
          <>
            {preview?.[0] && counts.vidhi > 0 && <Section text={text} title="Pooja Vidhi" total={counts.vidhi} tabKey="vidhi"><ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{preview[0].items.map((v) => <VidhiCardView key={v.id} v={v} />)}</ul></Section>}
            {preview?.[1] && counts.devotional > 0 && <Section text={text} title="Aarti & Mantras" total={counts.devotional} tabKey="devotional"><ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{preview[1].items.map((d) => <DevotionalCardView key={d.id} d={d} />)}</ul></Section>}
            {preview?.[2] && counts.posts > 0 && <Section text={text} title="Blog & guides" total={counts.posts} tabKey="posts"><ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{preview[2].items.map((p) => <PostCard key={p.id} p={p} showKind />)}</ul></Section>}
            {products && products.total > 0 && (
              <>
                {partial && <p className="mb-4 text-sm text-muted" role="status">No exact matches, so these products contain words starting with “{text}”.</p>}
                <ProductListing base="/search" query={query} result={products} facets={facets} hiddenFields={{ q: query.q }} heading={`Products for ${query.q}`} />
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function SearchPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
