import type { Metadata } from "next";
import { EditPageView } from "../../pages/PageViews";

export const metadata: Metadata = { title: "Edit guide" };

export default async function EditGuidesItem({ params }: PageProps<"/admin/guides/[id]">) {
  return <EditPageView kind="guide" id={(await params).id} />;
}
