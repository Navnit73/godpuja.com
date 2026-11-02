import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import PageView from "@/components/store/PageView";
import { buildPageMetadata } from "@/lib/seo";
import { validateSlug } from "@/lib/slug";
import { env } from "@/server/env";
import { getPublicPage } from "@/server/public/pages";

type Params = PageProps<"/[...slug]">["params"];

async function load(params: Params) {
  let slug: string;
  try {
    slug = (await params).slug.map(decodeURIComponent).join("/");
  } catch {
    return null; // malformed percent-encoding
  }
  if (validateSlug(slug)) return null; // never hit the cache/DB with junk paths
  return getPublicPage(slug);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = await load(params);
  return page ? buildPageMetadata(page, env().SITE_URL) : { robots: { index: false } };
}

async function Content({ params }: { params: Params }) {
  const page = await load(params);
  // Known limitation: unknown slugs render the 404 UI (with noindex) but the HTTP status is 200
  // because the static shell streams first. Proper 404 status is handled in Stage 10 (proxy lookup).
  if (!page) notFound();
  return <PageView page={page} />;
}

export default function CmsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-4xl px-4 py-12 text-muted" role="status">Loading…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
