import type { Metadata } from "next";
import type { PublicPage } from "@/server/services/pages";

/** Absolute URL for a CMS page path. */
/** The page with slug "home" is served at "/", so that is its canonical URL. */
export const pageUrl = (siteUrl: string, slug: string) => {
  const base = siteUrl.replace(/\/$/, "");
  return slug === "home" ? `${base}/` : `${base}/${slug}`;
};

export function buildPageMetadata(page: PublicPage, siteUrl: string): Metadata {
  const title = page.seo.title || page.title;
  const description = page.seo.description || page.description || undefined;
  const canonical = page.seo.canonical || pageUrl(siteUrl, page.slug);
  const noindex = page.isPreview || page.seo.noindex;
  const image = page.seo.ogImage || (page.kind !== "page" ? page.coverImageUrl : "");
  return {
    title,
    description,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: false } : undefined,
    referrer: page.isPreview ? "no-referrer" : undefined,
    openGraph: {
      type: page.kind === "page" ? "website" : "article", title, description, url: canonical,
      images: image ? [{ url: image }] : undefined,
      ...(page.kind !== "page" && page.publishedAt ? { publishedTime: page.publishedAt } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}
