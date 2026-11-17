import type { Metadata } from "next";
import { Suspense } from "react";
import { DetailContent, detailMetadata } from "@/components/store/DevotionalPages";

type Props = PageProps<"/aarti/[slug]">;
export const generateMetadata = ({ params }: Props): Promise<Metadata> => detailMetadata("aarti", params);

export default function Page({ params }: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><DetailContent section="aarti" params={params} /></Suspense>;
}
