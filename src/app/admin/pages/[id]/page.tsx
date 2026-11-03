import type { Metadata } from "next";
import { EditPageView } from "../PageViews";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  return <EditPageView kind="page" id={(await params).id} />;
}
