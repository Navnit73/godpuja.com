import type { Metadata } from "next";
import type { PublicPage } from "@/server/services/pages";

/** Absolute URL for a CMS page path. */
export const pageUrl = (siteUrl: string, slug: string) => `${siteUrl.replace(/\/$/, "")}/${slug}`;

export function buildPageMetadata(page: PublicPage, siteUrl: string): Metadata {
  const title = page.seo.title || page.title;
  const description = page.seo.description || page.description || undefined;
  const canonical = page.seo.canonical || pageUrl(siteUrl, page.slug);
  const noindex = page.isPreview || page.seo.noindex;
  return {
    title,
    description,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: false } : undefined,
    referrer: page.isPreview ? "no-referrer" : undefined,
    openGraph: {
      type: "website", title, description, url: canonical,
      images: page.seo.ogImage ? [{ url: page.seo.ogImage }] : undefined,
    },
    twitter: { card: page.seo.ogImage ? "summary_large_image" : "summary", title, description, images: page.seo.ogImage ? [page.seo.ogImage] : undefined },
  };
}
