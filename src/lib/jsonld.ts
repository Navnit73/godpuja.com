import type { PublicProductDetail } from "@/server/services/products";

/** JSON for a <script type="application/ld+json">: `<` is escaped so stored text can never close the script tag. */
export const serializeJsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => (c === "\u2028" ? "\\u2028" : "\\u2029"));

const abs = (base: string, path: string) => `${base.replace(/\/$/, "")}${path}`;
const rupees = (paise: number) => (paise / 100).toFixed(2);

export function breadcrumbLd(base: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(base, it.path) })),
  };
}

export function productLd(base: string, p: PublicProductDetail) {
  const url = abs(base, `/product/${p.slug}`);
  const availability = (inStock: boolean) => `https://schema.org/${p.upcoming ? "PreOrder" : inStock ? "InStock" : "OutOfStock"}`;
  const offers = p.variants.length
    ? (() => {
        const prices = p.variants.map((v) => v.salePrice ?? v.price);
        return { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: rupees(Math.min(...prices)), highPrice: rupees(Math.max(...prices)), offerCount: p.variants.length, availability: availability(p.variants.some((v) => v.inStock)), url };
      })()
    : { "@type": "Offer", priceCurrency: "INR", price: rupees(p.salePrice ?? p.price), availability: availability(p.inStock), itemCondition: "https://schema.org/NewCondition", url };
  return {
    "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, url,
    ...(p.images.length ? { image: p.images.map((i) => i.url) } : {}),
    ...(p.shortDescription ? { description: p.shortDescription } : {}),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    offers,
  };
}

export function articleLd(base: string, a: { title: string; slug: string; description: string; image: string; publishedAt: string | null; siteName: string }) {
  return {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: a.title, url: abs(base, `/${a.slug}`),
    mainEntityOfPage: abs(base, `/${a.slug}`), publisher: { "@type": "Organization", name: a.siteName },
    ...(a.description ? { description: a.description } : {}),
    ...(a.image ? { image: [a.image] } : {}),
    ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
  };
}

export function siteLd(base: string, s: { siteName: string; logoUrl: string; sameAs: string[] }) {
  const url = abs(base, "/");
  return [
    { "@context": "https://schema.org", "@type": "Organization", name: s.siteName, url, ...(s.logoUrl ? { logo: s.logoUrl } : {}), ...(s.sameAs.length ? { sameAs: s.sameAs } : {}) },
    {
      "@context": "https://schema.org", "@type": "WebSite", name: s.siteName, url,
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${abs(base, "/search")}?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ];
}
