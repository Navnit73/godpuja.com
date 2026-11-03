import type { Metadata } from "next";
import { NewPageView } from "../PageViews";

export const metadata: Metadata = { title: "New page" };

export default function NewPage() {
  return <NewPageView kind="page" />;
}
