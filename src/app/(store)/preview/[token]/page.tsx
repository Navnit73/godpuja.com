import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import PageView from "@/components/store/PageView";
import { buildPageMetadata } from "@/lib/seo";
import { env } from "@/server/env";
import { findPreviewPage } from "@/server/services/pages";

// Never cached: reads the page by its secret token on every request.
export async function generateMetadata({ params }: PageProps<"/preview/[token]">): Promise<Metadata> {
  await connection(); // request-time only: never prerender a secret-token page
  const page = await findPreviewPage((await params).token);
  return page ? buildPageMetadata(page, env().SITE_URL) : { robots: { index: false } };
}

async function Content({ params }: { params: PageProps<"/preview/[token]">["params"] }) {
  await connection();
  const page = await findPreviewPage((await params).token);
  if (!page) notFound();
  return <PageView page={page} />;
}

export default function PreviewPage({ params }: PageProps<"/preview/[token]">) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-4xl px-4 py-12 text-muted" role="status">Loading…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
