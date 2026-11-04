import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { ApiError } from "@/server/api";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getCategory, listCategories } from "@/server/services/categories";
import CategoryForm from "../CategoryForm";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategory({ params }: PageProps<"/admin/categories/[id]">) {
  const user = await currentUser();
  if (!user || !can(user.role, "categories:write")) return <Forbidden />;
  const [category, all] = await Promise.all([
    getCategory((await params).id).catch((e) => { if (e instanceof ApiError && e.code === "NOT_FOUND") notFound(); throw e; }),
    listCategories(),
  ]);
  return (
    <>
      <PageHeader title={category.name} description={`/shop/${category.path}`} />
      <CategoryForm category={category} all={all} />
    </>
  );
}
