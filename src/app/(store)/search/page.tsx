import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import ProductListing from "@/components/store/ProductListing";
import { parseListing } from "@/lib/listing";
import { findPublicProducts } from "@/server/services/products";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } }; // result pages are not indexed

type Props = PageProps<"/search">;

async function Content({ searchParams }: Props) {
  await connection();
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim() : "";
  const query = parseListing(raw);
  const result = query.q ? await findPublicProducts(query) : null;
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Search" }]} />
      <h1 className="text-4xl font-semibold">Search</h1>
      <form method="get" action="/search" role="search" className="mt-4 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">Search products</label>
        <input id="q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Search puja items, idols, kits…" className="input flex-1" />
        <button type="submit" className="btn-primary">Search</button>
      </form>
      <div className="divider-gold my-6" />
      {!query.q
        ? <p className="text-muted">{q.length === 1 ? "Type at least 2 characters to search." : "Enter a word to find products."}</p>
        : <><h2 className="sr-only">Results for {query.q}</h2><ProductListing base="/search" query={query} result={result!} hiddenFields={{ q: query.q }} /></>}
    </main>
  );
}

export default function SearchPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
