import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import PageBand from "@/components/store/PageBand";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/jsonld";
import ProductListing from "@/components/store/ProductListing";
import { parseListing } from "@/lib/listing";
import { publicProductsSchema } from "@/lib/validation/catalog";
import { env } from "@/server/env";
import { findPublicCategory } from "@/server/services/categories";
import { findPublicProducts } from "@/server/services/products";

type Props = PageProps<"/category/[...path]">;

async function pathOf(params: Props["params"]) {
  try {
    const path = (await params).path.map(decodeURIComponent).join("/");
    return publicProductsSchema.shape.category.safeParse(path).success ? path : null; // never hit the DB with junk
  } catch { return null; }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  await connection();
  const path = await pathOf(params);
  const cat = path ? await findPublicCategory(path) : null;
  if (!cat) return { robots: { index: false } };
  const title = cat.seo.title || cat.name;
  const description = cat.seo.description || cat.description || undefined;
  const q = parseListing(await searchParams, { category: cat.path, q: undefined });
  // Sorted/filtered variants are near-duplicates: noindex them and point at the plain listing. Plain pages 2..n
  // are distinct content and canonicalise to themselves.
  const filtered = q.sort !== "newest" || q.minPrice !== undefined || q.maxPrice !== undefined;
  const base = `${env().SITE_URL.replace(/\/$/, "")}/category/${cat.path}`;
  const canonical = cat.seo.canonical || (!filtered && q.page > 1 ? `${base}?page=${q.page}` : base);
  return {
    title: q.page > 1 && !filtered ? `${title} — page ${q.page}` : title, description, alternates: { canonical },
    robots: cat.seo.noindex ? { index: false, follow: false } : filtered ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", title, description, url: canonical, images: cat.seo.ogImage || cat.image.url ? [{ url: cat.seo.ogImage || cat.image.url }] : undefined },
  };
}

async function Content({ params, searchParams }: Props) {
  await connection();
  const path = await pathOf(params);
  const cat = path ? await findPublicCategory(path) : null;
  if (!path || !cat) notFound();
  const query = parseListing(await searchParams, { category: path, q: undefined });
  const result = await findPublicProducts(query);
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <JsonLd data={breadcrumbLd(env().SITE_URL, [{ name: "Home", path: "/" }, ...cat.breadcrumbs.map((b) => ({ name: b.name, path: `/category/${b.path}` }))])} />
      <PageBand title={cat.name} description={cat.description || undefined}
        crumbs={[{ name: "Home", href: "/" }, ...cat.breadcrumbs.map((b, i, a) => ({ name: b.name, href: i < a.length - 1 ? `/category/${b.path}` : undefined }))]}>
        {cat.children.length > 0 && (
          <nav aria-label="Subcategories" className="mt-5"><ul className="flex flex-wrap gap-2">
            {cat.children.map((c) => <li key={c.id}><Link href={`/category/${c.path}`} className="chip-dark">{c.name}</Link></li>)}
          </ul></nav>
        )}
      </PageBand>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <ProductListing base={`/category/${cat.path}`} query={query} result={result} />
      </div>
    </main>
  );
}

export default function CategoryPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
