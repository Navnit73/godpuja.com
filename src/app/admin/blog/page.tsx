import type { Metadata } from "next";
import PagesListView from "../pages/PagesListView";

export const metadata: Metadata = { title: "Blog" };

export default function BlogList({ searchParams }: PageProps<"/admin/blog">) {
  return <PagesListView kind="blog" searchParams={searchParams} />;
}
