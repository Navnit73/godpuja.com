import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import VidhiEditor from "../VidhiEditor";

export const metadata: Metadata = { title: "New guide" };

export default async function NewVidhi() {
  const user = await currentUser();
  if (!user || !can(user.role, "vidhi:write")) return <Forbidden />;
  return (
    <>
      <PageHeader title="New guide" description="Guides start as drafts. Publish once a reviewer has checked them." />
      <VidhiEditor vidhi={null} canPublish={can(user.role, "vidhi:publish")} />
    </>
  );
}
