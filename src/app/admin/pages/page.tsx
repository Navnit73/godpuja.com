import type { Metadata } from "next";
import PagesListView from "./PagesListView";

export const metadata: Metadata = { title: "Pages" };

export default function PagesList({ searchParams }: PageProps<"/admin/pages">) {
  return <PagesListView kind="page" searchParams={searchParams} />;
}
