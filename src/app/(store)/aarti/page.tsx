import type { Metadata } from "next";
import { Suspense } from "react";
import { IndexContent, indexMetadata } from "@/components/store/DevotionalPages";

type Props = PageProps<"/aarti">;
export const generateMetadata = ({ searchParams }: Props): Promise<Metadata> => indexMetadata("aarti", searchParams);

export default function Page({ searchParams }: Props) {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}><IndexContent section="aarti" searchParams={searchParams} /></Suspense>;
}
