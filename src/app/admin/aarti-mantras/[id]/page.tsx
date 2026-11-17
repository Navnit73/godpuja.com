import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { devotionalHref } from "@/lib/validation/devotional";
import { ApiError } from "@/server/api";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getDevotional } from "@/server/services/devotional";
import DevotionalEditor from "../DevotionalEditor";

export const metadata: Metadata = { title: "Edit aarti or mantra" };

export default async function EditDevotional({ params }: PageProps<"/admin/aarti-mantras/[id]">) {
  const user = await currentUser();
  if (!user || !can(user.role, "devotional:read")) return <Forbidden />;
  const d = await getDevotional((await params).id).catch((e) => { if (e instanceof ApiError && e.code === "NOT_FOUND") notFound(); throw e; });
  return (
    <>
      <PageHeader title={d.title} description={devotionalHref(d.type, d.slug)} />
      {/* Same rule as the API: without publish rights, only drafts can be edited. */}
      <DevotionalEditor item={d} canPublish={can(user.role, "devotional:publish")} readOnly={!can(user.role, "devotional:write") || (d.status !== "draft" && !can(user.role, "devotional:publish"))} />
    </>
  );
}
