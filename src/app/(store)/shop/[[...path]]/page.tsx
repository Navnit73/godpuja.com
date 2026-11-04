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
import { categoryHref, SHOP } from "@/lib/shop-url";
import { publicProductsSchema } from "@/lib/validation/catalog";
import { env } from "@/server/env";
import { findCategoryTree, findPublicCategory } from "@/server/services/categories";
import { findPublicProducts } from "@/server/services/products";

type Props = PageProps<"/shop/[[...path]]">;

/** `/shop` -> "" (everything). `/shop/a/b` -> "a/b". null = a path no category can have (never hit the database with junk). */
async function pathOf(params: Props["params"]) {
  try {
    const path = ((await params).path ?? []).map(decodeURIComponent).join("/");
    if (path === "") return "";
    return publicProductsSchema.shape.category.safeParse(path).success ? path : null;
  } catch { return null; }
}

const site = () => env().SITE_URL.replace(/\/$/, "");

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  await connection();
  const path = await pathOf(params);
  if (path === null) return { robots: { index: false } };
  const sp = await searchParams;
  if (path === "") {
    const q = parseListing(sp, { category: undefined, q: undefined });
    const filtered = q.sort !== "newest" || q.minPrice !== undefined || q.maxPrice !== undefined;
    const base = `${site()}${SHOP}`;
    const canonical = !filtered && q.page > 1 ? `${base}?page=${q.page}` : base;
    const description = "Pooja samagri, idols, diyas, incense, malas and more for your daily worship and festivals.";
    return {
      title: q.page > 1 && !filtered ? `Shop — page ${q.page}` : "Shop", description, alternates: { canonical },
      robots: filtered ? { index: false, follow: true } : undefined, openGraph: { type: "website", title: "Shop", description, url: canonical },
    };
  }
  const cat = await findPublicCategory(path);
  if (!cat) return { robots: { index: false } };
  const title = cat.seo.title || cat.name;
  const description = cat.seo.description || cat.description || undefined;
  const q = parseListing(sp, { category: cat.path, q: undefined });
  // Sorted/filtered variants are near-duplicates: noindex them and point at the plain listing. Plain pages 2..n
  // are distinct content and canonicalise to themselves.
  const filtered = q.sort !== "newest" || q.minPrice !== undefined || q.maxPrice !== undefined;
  const base = `${site()}${categoryHref(cat.path)}`;
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
  if (path === null) notFound();
  const sp = await searchParams;

  if (path === "") {
    const query = parseListing(sp, { category: undefined, q: undefined });
    const [result, tree] = await Promise.all([findPublicProducts(query), findCategoryTree()]);
    return (
      <main id="main" tabIndex={-1} className="w-full flex-1">
        <JsonLd data={breadcrumbLd(env().SITE_URL, [{ name: "Home", path: "/" }, { name: "Shop", path: SHOP }])} />
        <PageBand title="Shop" description="Everything for your puja, from daily samagri to festival collections." crumbs={[{ name: "Home", href: "/" }, { name: "Shop" }]}>
          {tree.length > 0 && (
            <nav aria-label="Categories" className="mt-5"><ul className="flex flex-wrap gap-2">
              {tree.map((c) => <li key={c.id}><Link href={categoryHref(c.path)} className="chip-dark">{c.name}</Link></li>)}
            </ul></nav>
          )}
        </PageBand>
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          <ProductListing base={SHOP} query={query} result={result} />
        </div>
      </main>
    );
  }

  const cat = await findPublicCategory(path);
  if (!cat) notFound();
  const query = parseListing(sp, { category: path, q: undefined });
  const result = await findPublicProducts(query);
  const crumbs = [{ name: "Shop", path: SHOP }, ...cat.breadcrumbs.map((b) => ({ name: b.name, path: categoryHref(b.path) }))];
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <JsonLd data={breadcrumbLd(env().SITE_URL, [{ name: "Home", path: "/" }, ...crumbs])} />
      <PageBand title={cat.name} description={cat.description || undefined}
        crumbs={[{ name: "Home", href: "/" }, ...crumbs.map((c, i) => ({ name: c.name, href: i < crumbs.length - 1 ? c.path : undefined }))]}>
        {cat.children.length > 0 && (
          <nav aria-label="Subcategories" className="mt-5"><ul className="flex flex-wrap gap-2">
            {cat.children.map((c) => <li key={c.id}><Link href={categoryHref(c.path)} className="chip-dark">{c.name}</Link></li>)}
          </ul></nav>
        )}
      </PageBand>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <ProductListing base={categoryHref(cat.path)} query={query} result={result} />
      </div>
    </main>
  );
}

export default function ShopPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
