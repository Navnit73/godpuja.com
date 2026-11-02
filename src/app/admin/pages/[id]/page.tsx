import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { ApiError } from "@/server/api";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getPage } from "@/server/services/pages";
import PageEditor from "../PageEditor";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  const user = await currentUser();
  if (!user || !can(user.role, "pages:read")) return <Forbidden />;
  const page = await getPage((await params).id).catch((e) => {
    if (e instanceof ApiError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title={page.title} description={`/${page.slug}`} />
      <PageEditor page={page} canPublish={can(user.role, "pages:publish")} readOnly={!can(user.role, "pages:write")} />
    </>
  );
}
