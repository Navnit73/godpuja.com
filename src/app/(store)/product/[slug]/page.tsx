import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import AddToCart from "@/components/store/AddToCart";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd, productLd } from "@/lib/jsonld";
import ProductCard from "@/components/store/ProductCard";
import ProductGallery from "@/components/store/ProductGallery";
import { LotusOrnament, ShieldIcon, TruckIcon } from "@/components/store/Icons";
import { env } from "@/server/env";
import { getPublicProduct } from "@/server/public/catalog";
import { findRelated } from "@/server/services/products";

type Props = PageProps<"/product/[slug]">;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function load(params: Props["params"]) {
  const slug = (await params).slug;
  if (!SLUG.test(slug) || slug.length > 80) return null; // never hit the cache/DB with junk
  return getPublicProduct(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const p = await load(params);
  if (!p) return { robots: { index: false } };
  const title = p.seo.title || p.name;
  const description = p.seo.description || p.shortDescription || undefined;
  const canonical = p.seo.canonical || `${env().SITE_URL.replace(/\/$/, "")}/product/${p.slug}`;
  const image = p.seo.ogImage || p.images[0]?.url;
  return {
    title, description, alternates: { canonical }, robots: p.seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { type: "website", title, description, url: canonical, images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

async function Related({ slug }: { slug: string }) {
  await connection();
  const items = await findRelated(slug);
  if (!items.length) return null;
  return (
    <section aria-labelledby="related" className="mt-12 sm:mt-16">
      <h2 id="related" className="section-title">You may also like</h2>
      <LotusOrnament className="mb-5 mt-2 h-4 w-16 text-accent sm:mb-6" />
      {/* Below sm: swipeable rail (same as the homepage rails); from sm up: grid. */}
      <ul className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0">
        {items.map((p) => <ProductCard key={p.id} p={p} className="w-5/12 shrink-0 snap-start sm:w-auto" />)}
      </ul>
    </section>
  );
}

async function Content({ params }: Props) {
  await connection();
  const p = await load(params);
  // Known limitation (same as CMS pages): the 404 UI streams with HTTP 200; Stage 10 adds the proper status.
  if (!p) notFound();
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-4 sm:px-6 sm:py-8">
      <JsonLd data={[productLd(env().SITE_URL, p), breadcrumbLd(env().SITE_URL, [{ name: "Home", path: "/" }, ...p.breadcrumbs.map((c) => ({ name: c.name, path: `/shop/${c.path}` })), { name: p.name, path: `/product/${p.slug}` }])]} />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, ...p.breadcrumbs.map((c) => ({ name: c.name, href: `/shop/${c.path}` })), { name: p.name }]} />
      <div className="grid gap-5 md:grid-cols-2 md:gap-8 lg:gap-12">
        <ProductGallery images={p.images} name={p.name} />
        <div className="space-y-5 sm:space-y-6">
          <div>
            {p.brand && <p className="eyebrow">{p.brand}</p>}
            <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{p.name}</h1>
            <LotusOrnament className="mt-2 h-4 w-20 text-accent sm:mt-3" />
            {p.shortDescription && <p className="mt-2 text-base text-muted sm:mt-3 sm:text-lg">{p.shortDescription}</p>}
          </div>
          <div className="rounded-2xl border border-sandal-200 bg-dawn p-4 sm:p-6">
            <AddToCart productId={p.id} price={p.price} salePrice={p.salePrice} inStock={p.inStock} upcoming={p.upcoming} variants={p.variants} />
          </div>
          <ul className="grid grid-cols-2 gap-2 text-xs sm:gap-3 sm:text-sm">
            <li className="flex items-center gap-2 rounded-xl border border-sandal-200 bg-surface px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3"><ShieldIcon className="h-5 w-5 shrink-0 text-primary" />Secure payments</li>
            <li className="flex items-center gap-2 rounded-xl border border-sandal-200 bg-surface px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3"><TruckIcon className="h-5 w-5 shrink-0 text-primary" />{p.freeShipping ? <span className="font-medium text-success">Free shipping</span> : "Packed with care"}</li>
          </ul>
          {p.attributes.length > 0 && (
            <dl className="divide-y divide-sandal-200 overflow-hidden rounded-xl border border-sandal-200 bg-surface text-sm">
              {p.attributes.map((a, i) => <div key={i} className="grid grid-cols-[8rem_1fr] gap-4 px-4 py-2.5"><dt className="font-medium">{a.name}</dt><dd className="text-muted">{a.value}</dd></div>)}
              <div className="grid grid-cols-[8rem_1fr] gap-4 px-4 py-2.5"><dt className="font-medium">SKU</dt><dd className="text-muted">{p.sku}</dd></div>
            </dl>
          )}
          {p.attributes.length === 0 && <p className="text-sm text-muted">SKU: {p.sku}</p>}
        </div>
      </div>
      {p.descriptionHtml && (
        <section aria-labelledby="about" className="mt-10 max-w-3xl border-t border-sandal-200 pt-8 sm:mt-14 sm:pt-10">
          <h2 id="about" className="section-title">About this product</h2>
          <LotusOrnament className="mb-4 mt-2 h-4 w-16 text-accent sm:mb-5" />
          <div className="content" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} />
        </section>
      )}
      <Suspense fallback={null}><Related slug={p.slug} /></Suspense>
      <p className="mt-8 text-sm sm:mt-10"><Link href="/" className="text-primary underline">Continue shopping</Link></p>
    </main>
  );
}

export default function ProductPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
