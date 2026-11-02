import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { ApiError } from "@/server/api";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getMenu, listLinkablePages } from "@/server/services/menus";
import MenuEditor from "../MenuEditor";

export const metadata: Metadata = { title: "Edit menu" };

export default async function EditMenu({ params }: PageProps<"/admin/navigation/[id]">) {
  const user = await currentUser();
  if (!user || !can(user.role, "nav:write")) return <Forbidden />;
  const [menu, pages] = await Promise.all([
    getMenu((await params).id).catch((e) => {
      if (e instanceof ApiError && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
    listLinkablePages(),
  ]);
  return (
    <>
      <PageHeader title={menu.name} description={`Menu key: ${menu.key}`} />
      <MenuEditor menu={menu} pages={pages} />
    </>
  );
}
