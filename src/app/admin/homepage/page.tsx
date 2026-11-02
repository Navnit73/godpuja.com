import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listCategories } from "@/server/services/categories";
import { getHomepage } from "@/server/services/homepage";
import HomepageEditor from "./HomepageEditor";

export const metadata: Metadata = { title: "Homepage" };

export default async function HomepageAdmin() {
  const user = await currentUser();
  if (!user || !can(user.role, "home:write")) return <Forbidden />;
  const [home, categories] = await Promise.all([getHomepage(), listCategories()]);
  return (
    <>
      <PageHeader title="Homepage" description="Build the storefront homepage from sections. Reorder, hide or edit them; changes go live when you save." />
      <HomepageEditor initial={home} categories={categories.map((c) => ({ id: c.id, name: c.name, path: c.path, level: c.level }))} />
    </>
  );
}
