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
    <section aria-labelledby="related" className="mt-16">
      <h2 id="related" className="section-title">You may also like</h2>
      <LotusOrnament className="mb-6 mt-2 h-4 w-16 text-accent" />
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
    </section>
  );
}

async function Content({ params }: Props) {
  await connection();
  const p = await load(params);
  // Known limitation (same as CMS pages): the 404 UI streams with HTTP 200; Stage 10 adds the proper status.
  if (!p) notFound();
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <JsonLd data={[productLd(env().SITE_URL, p), breadcrumbLd(env().SITE_URL, [{ name: "Home", path: "/" }, ...p.breadcrumbs.map((c) => ({ name: c.name, path: `/category/${c.path}` })), { name: p.name, path: `/product/${p.slug}` }])]} />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, ...p.breadcrumbs.map((c) => ({ name: c.name, href: `/category/${c.path}` })), { name: p.name }]} />
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <ProductGallery images={p.images} name={p.name} />
        <div className="space-y-5">
          <div>
            {p.brand && <p className="eyebrow">{p.brand}</p>}
            <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">{p.name}</h1>
            <LotusOrnament className="mt-3 h-4 w-20 text-accent" />
            {p.shortDescription && <p className="mt-3 text-lg text-muted">{p.shortDescription}</p>}
          </div>
          <div className="rounded-2xl border border-sandal-200 bg-dawn p-5 sm:p-6">
            <AddToCart productId={p.id} price={p.price} salePrice={p.salePrice} inStock={p.inStock} variants={p.variants} />
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2.5"><ShieldIcon className="h-5 w-5 shrink-0 text-primary" />Secure payments</li>
            <li className="flex items-center gap-2.5"><TruckIcon className="h-5 w-5 shrink-0 text-primary" />{p.freeShipping ? <span className="font-medium text-success">Free shipping</span> : "Packed with care"}</li>
          </ul>
          <p className="text-sm text-muted">SKU: {p.sku}</p>
          {p.attributes.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-t border-border pt-4 text-sm">
              {p.attributes.map((a, i) => <div key={i} className="contents"><dt className="font-medium">{a.name}</dt><dd className="text-muted">{a.value}</dd></div>)}
            </dl>
          )}
        </div>
      </div>
      {p.descriptionHtml && (
        <section aria-labelledby="about" className="mt-14 max-w-3xl">
          <h2 id="about" className="section-title">About this product</h2>
          <LotusOrnament className="mb-5 mt-2 h-4 w-16 text-accent" />
          <div className="content" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} />
        </section>
      )}
      <Suspense fallback={null}><Related slug={p.slug} /></Suspense>
      <p className="mt-10 text-sm"><Link href="/" className="text-primary underline">Continue shopping</Link></p>
    </main>
  );
}

export default function ProductPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
