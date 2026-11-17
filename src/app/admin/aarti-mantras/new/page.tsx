import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import DevotionalEditor from "../DevotionalEditor";

export const metadata: Metadata = { title: "New aarti or mantra" };

export default async function NewDevotional() {
  const user = await currentUser();
  if (!user || !can(user.role, "devotional:write")) return <Forbidden />;
  return (
    <>
      <PageHeader title="New aarti or mantra" description="Items start as drafts. Publish once a reviewer has checked the text." />
      <DevotionalEditor item={null} canPublish={can(user.role, "devotional:publish")} />
    </>
  );
}
