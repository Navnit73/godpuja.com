import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listCategories } from "@/server/services/categories";
import ProductEditor from "../ProductEditor";

export const metadata: Metadata = { title: "New product" };

export default async function NewProduct() {
  const user = await currentUser();
  if (!user || !can(user.role, "products:write")) return <Forbidden />;
  return (<><PageHeader title="New product" /><ProductEditor product={null} categories={await listCategories()} canWrite /></>);
}
