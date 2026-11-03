import type { Metadata } from "next";
import { EditPageView } from "../../pages/PageViews";

export const metadata: Metadata = { title: "Edit blog post" };

export default async function EditBlogItem({ params }: PageProps<"/admin/blog/[id]">) {
  return <EditPageView kind="blog" id={(await params).id} />;
}
