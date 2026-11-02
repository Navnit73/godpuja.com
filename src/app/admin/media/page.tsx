import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { mediaConfigured } from "@/server/cloudinary";
import { listMedia } from "@/server/services/media";
import MediaClient from "./MediaClient";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  const user = await currentUser();
  if (!user || !can(user.role, "media:write")) return <Forbidden />;
  const raw = (await searchParams).page;
  const page = Math.min(10_000, Math.max(1, Math.trunc(Number(typeof raw === "string" ? raw : 1)) || 1));
  const data = await listMedia(page, 24);
  return (
    <>
      <PageHeader title="Media" description="Images for products and categories. JPEG, PNG, GIF or WebP, up to 5 MB." />
      <MediaClient initial={data.items} configured={mediaConfigured()} page={data.page} pages={data.pages} total={data.total} />
    </>
  );
}
