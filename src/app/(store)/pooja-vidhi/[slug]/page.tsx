import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import JsonLd from "@/components/JsonLd";
import VidhiView from "@/components/store/VidhiView";
import { articleLd, breadcrumbLd } from "@/lib/jsonld";
import { vidhiHref, VIDHI_BASE } from "@/lib/validation/vidhi";
import { env } from "@/server/env";
import { getPublicVidhi } from "@/server/public/vidhi";
import { getSiteSettings } from "@/server/public/settings";

type Props = PageProps<"/pooja-vidhi/[slug]">;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function load(params: Props["params"]) {
  const slug = (await params).slug;
  if (!SLUG.test(slug) || slug.length > 80) return null; // never hit the cache or database with junk
  return getPublicVidhi(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const v = await load(params);
  if (!v) return { robots: { index: false } };
  const title = v.seo.title || v.title;
  const description = v.seo.description || v.excerpt || undefined;
  const canonical = v.seo.canonical || `${env().SITE_URL.replace(/\/$/, "")}${vidhiHref(v.slug)}`;
  const image = v.seo.ogImage || v.cover?.url;
  return {
    title, description, alternates: { canonical }, robots: v.seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { type: "article", title, description, url: canonical, images: image ? [{ url: image }] : undefined, publishedTime: v.publishedAt ?? undefined, modifiedTime: v.updatedAt },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

async function Content({ params }: Props) {
  await connection();
  const v = await load(params);
  if (!v) notFound();
  const site = env().SITE_URL;
  const s = await getSiteSettings();
  return (
    <>
      <JsonLd data={[
        articleLd(site, { type: "Article", title: v.title, slug: v.slug, path: vidhiHref(v.slug), description: v.excerpt, image: v.cover?.url ?? "", publishedAt: v.publishedAt, modifiedAt: v.updatedAt, author: v.author, siteName: s.siteName }),
        breadcrumbLd(site, [{ name: "Home", path: "/" }, { name: "Pooja Vidhi", path: VIDHI_BASE }, { name: v.title, path: vidhiHref(v.slug) }]),
      ]} />
      <VidhiView v={v} />
    </>
  );
}

export default function VidhiPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><Content {...props} /></Suspense>;
}
