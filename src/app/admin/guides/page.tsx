import type { Metadata } from "next";
import PagesListView from "../pages/PagesListView";

export const metadata: Metadata = { title: "Guides" };

export default function GuidesList({ searchParams }: PageProps<"/admin/guides">) {
  return <PagesListView kind="guide" searchParams={searchParams} />;
}
