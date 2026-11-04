import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import VidhiView from "@/components/store/VidhiView";
import { findPreviewVidhi } from "@/server/services/vidhi";

// Never cached or indexed: reads the guide by its secret token on every request (any status, including drafts).
export const metadata: Metadata = { title: "Guide preview", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function Content({ params }: { params: PageProps<"/preview/pooja-vidhi/[token]">["params"] }) {
  await connection();
  const v = await findPreviewVidhi((await params).token);
  if (!v) notFound();
  return <VidhiView v={v} preview />;
}

export default function VidhiPreviewPage({ params }: PageProps<"/preview/pooja-vidhi/[token]">) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-3xl px-4 py-12 text-muted" role="status">Loading…</div>}><Content params={params} /></Suspense>;
}
