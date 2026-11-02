import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import PageEditor from "../PageEditor";

export const metadata: Metadata = { title: "New page" };

export default async function NewPage() {
  const user = await currentUser();
  if (!user || !can(user.role, "pages:write")) return <Forbidden />;
  return (
    <>
      <PageHeader title="New page" description="Pages start as drafts. Publish when you are ready." />
      <PageEditor page={null} canPublish={can(user.role, "pages:publish")} />
    </>
  );
}
