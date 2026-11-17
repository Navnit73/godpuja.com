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
import { ShieldIcon, TruckIcon } from "@/components/store/Icons";
import { env } from "@/server/env";
import { getPublicProduct } from "@/server/public/catalog";
import { findRelated } from "@/server/services/products";
import ProductReviews from "@/components/store/ProductReviews";
import RecentlyViewed from "@/components/store/RecentlyViewed";
import Stars from "@/components/store/Stars";
import WishlistButton from "@/components/store/WishlistButton";

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
    <section aria-labelledby="related" className="mt-16 sm:mt-20">
      <h2 id="related" className="section-title mb-6 sm:mb-8">You may also like</h2>
      {/* Below sm: swipeable rail (same as the homepage rails); from sm up: grid. */}
      <ul className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0">
        {items.map((p) => <ProductCard key={p.id} p={p} className="w-5/12 shrink-0 snap-start sm:w-auto" />)}
      </ul>
    </section>
  );
}

const TRUST = "flex items-center gap-3 rounded-lg bg-sandal-100 px-4 py-3 text-sm font-medium";
const TRUST_ICON = "h-5 w-5 shrink-0 text-foreground";

async function Content({ params }: Props) {
  await connection();
  const p = await load(params);
  // Known limitation (same as CMS pages): the 404 UI streams with HTTP 200; Stage 10 adds the proper status.
  if (!p) notFound();
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <JsonLd data={[productLd(env().SITE_URL, p), breadcrumbLd(env().SITE_URL, [{ name: "Home", path: "/" }, ...p.breadcrumbs.map((c) => ({ name: c.name, path: `/shop/${c.path}` })), { name: p.name, path: `/product/${p.slug}` }])]} />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, ...p.breadcrumbs.map((c) => ({ name: c.name, href: `/shop/${c.path}` })), { name: p.name }]} />
      <div className="grid gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery images={p.images} name={p.name} />
        <div className="flex min-w-0 flex-col gap-8">
          <header className="space-y-3">
            {p.brand && <p className="eyebrow">{p.brand}</p>}
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">{p.name}</h1>
            {p.rating && <a href="#reviews" className="inline-block"><Stars avg={p.rating.avg} count={p.rating.count} /></a>}
            {p.shortDescription && <p className="max-w-prose text-base text-muted sm:text-lg">{p.shortDescription}</p>}
          </header>
          <div className="border-y border-sandal-200 py-8">
            <AddToCart productId={p.id} price={p.price} salePrice={p.salePrice} inStock={p.inStock} upcoming={p.upcoming} variants={p.variants} />
          </div>
          <WishlistButton productId={p.id} name={p.name} />
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className={TRUST}><ShieldIcon className={TRUST_ICON} />Secure payments</li>
            <li className={TRUST}><TruckIcon className={TRUST_ICON} />{p.freeShipping ? <span className="text-success">Free shipping</span> : "Packed with care"}</li>
          </ul>
          <section aria-labelledby="details">
            <h2 id="details" className="mb-2 font-display text-lg font-bold">Details</h2>
            <dl className="divide-y divide-sandal-200 border-y border-sandal-200 text-sm">
              {p.attributes.map((a, i) => <div key={i} className="grid grid-cols-[8rem_1fr] gap-4 py-3"><dt className="font-medium">{a.name}</dt><dd className="text-muted">{a.value}</dd></div>)}
              <div className="grid grid-cols-[8rem_1fr] gap-4 py-3"><dt className="font-medium">SKU</dt><dd className="text-muted">{p.sku}</dd></div>
            </dl>
          </section>
        </div>
      </div>
      {p.descriptionHtml && (
        <section aria-labelledby="about" className="mt-16 grid gap-6 border-t border-sandal-200 pt-12 sm:mt-20 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
          <h2 id="about" className="section-title text-2xl sm:text-3xl">About this product</h2>
          <div className="content max-w-3xl" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} />
        </section>
      )}
      <Suspense fallback={null}><ProductReviews productId={p.id} slug={p.slug} /></Suspense>
      <Suspense fallback={null}><Related slug={p.slug} /></Suspense>
      <RecentlyViewed slug={p.slug} />
      <p className="mt-12 text-sm"><Link href="/" className="font-semibold text-primary underline underline-offset-4">Continue shopping</Link></p>
    </main>
  );
}

export default function ProductPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
