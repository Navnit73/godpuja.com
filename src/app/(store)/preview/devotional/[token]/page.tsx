import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import DevotionalView from "@/components/store/DevotionalView";
import { findPreviewDevotional } from "@/server/services/devotional";

// Never cached or indexed: reads the item by its secret token on every request (any status, including drafts).
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function Content({ params }: { params: PageProps<"/preview/devotional/[token]">["params"] }) {
  await connection();
  const d = await findPreviewDevotional((await params).token);
  if (!d) notFound();
  return <DevotionalView d={d} preview />;
}

export default function DevotionalPreviewPage({ params }: PageProps<"/preview/devotional/[token]">) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-3xl px-4 py-12 text-muted" role="status">Loading…</div>}><Content params={params} /></Suspense>;
}
