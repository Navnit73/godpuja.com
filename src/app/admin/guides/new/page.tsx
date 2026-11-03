import type { Metadata } from "next";
import { NewPageView } from "../../pages/PageViews";

export const metadata: Metadata = { title: "New guide" };

export default function NewGuidesItem() {
  return <NewPageView kind="guide" />;
}
