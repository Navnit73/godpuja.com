import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { ApiError } from "@/server/api";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listCategories } from "@/server/services/categories";
import { getProduct } from "@/server/services/products";
import ProductEditor from "../ProductEditor";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProduct({ params }: PageProps<"/admin/products/[id]">) {
  const user = await currentUser();
  if (!user || !can(user.role, "products:read")) return <Forbidden />;
  const [product, categories] = await Promise.all([
    getProduct((await params).id).catch((e) => { if (e instanceof ApiError && e.code === "NOT_FOUND") notFound(); throw e; }),
    listCategories(),
  ]);
  return (<><PageHeader title={product.name} description={`/product/${product.slug}`} /><ProductEditor product={product} categories={categories} canWrite={can(user.role, "products:write")} /></>);
}
