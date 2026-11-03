import type { Metadata } from "next";
import { NewPageView } from "../../pages/PageViews";

export const metadata: Metadata = { title: "New blog post" };

export default function NewBlogItem() {
  return <NewPageView kind="blog" />;
}
