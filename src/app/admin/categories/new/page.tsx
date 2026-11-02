import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listCategories } from "@/server/services/categories";
import CategoryForm from "../CategoryForm";

export const metadata: Metadata = { title: "New category" };

export default async function NewCategory() {
  const user = await currentUser();
  if (!user || !can(user.role, "categories:write")) return <Forbidden />;
  return (
    <>
      <PageHeader title="New category" />
      <CategoryForm category={null} all={await listCategories()} />
    </>
  );
}
