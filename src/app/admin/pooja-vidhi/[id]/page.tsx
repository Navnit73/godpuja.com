import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { ApiError } from "@/server/api";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getVidhi } from "@/server/services/vidhi";
import VidhiEditor from "../VidhiEditor";

export const metadata: Metadata = { title: "Edit guide" };

export default async function EditVidhi({ params }: PageProps<"/admin/pooja-vidhi/[id]">) {
  const user = await currentUser();
  if (!user || !can(user.role, "vidhi:read")) return <Forbidden />;
  const v = await getVidhi((await params).id).catch((e) => { if (e instanceof ApiError && e.code === "NOT_FOUND") notFound(); throw e; });
  return (
    <>
      <PageHeader title={v.title} description={`/pooja-vidhi/${v.slug}`} />
      {/* Same rule as the API: without publish rights, only drafts can be edited. */}
      <VidhiEditor vidhi={v} canPublish={can(user.role, "vidhi:publish")} readOnly={!can(user.role, "vidhi:write") || (v.status !== "draft" && !can(user.role, "vidhi:publish"))} />
    </>
  );
}
