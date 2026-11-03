import { notFound, redirect } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { KIND_META, type PageKind } from "@/lib/validation/pages";
import { ApiError } from "@/server/api";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getPage } from "@/server/services/pages";
import PageEditor from "./PageEditor";

const NEW_TITLE: Record<PageKind, string> = { page: "New page", blog: "New blog post", guide: "New guide" };

export async function NewPageView({ kind }: { kind: PageKind }) {
  const user = await currentUser();
  if (!user || !can(user.role, "pages:write")) return <Forbidden />;
  return (
    <>
      <PageHeader title={NEW_TITLE[kind]} description={`${KIND_META[kind].label}s start as drafts. Publish when you are ready.`} />
      <PageEditor page={null} kind={kind} canPublish={can(user.role, "pages:publish")} />
    </>
  );
}

/** Opening an item under the wrong section (e.g. a guide at /admin/blog/…) redirects to its own section. */
export async function EditPageView({ kind, id }: { kind: PageKind; id: string }) {
  const user = await currentUser();
  if (!user || !can(user.role, "pages:read")) return <Forbidden />;
  const page = await getPage(id).catch((e) => {
    if (e instanceof ApiError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  if (page.kind !== kind) redirect(`${KIND_META[page.kind].admin}/${page.id}`);
  return (
    <>
      <PageHeader title={page.title} description={`/${page.slug}`} />
      <PageEditor page={page} kind={page.kind} canPublish={can(user.role, "pages:publish")} readOnly={!can(user.role, "pages:write")} />
    </>
  );
}
