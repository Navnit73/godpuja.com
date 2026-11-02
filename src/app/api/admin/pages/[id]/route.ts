import { ApiError, handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { invalidatePages } from "@/server/public/pages";
import { deletePage, getPage, updatePage } from "@/server/services/pages";
import { updatePageSchema } from "@/lib/validation/pages";

type Ctx = RouteContext<"/api/admin/pages/[id]">;

// Changing or deleting content that is (or was scheduled to be) public requires publish rights too.
async function assertMayChange(user: { role: Parameters<typeof can>[0] }, id: string) {
  const existing = await getPage(id);
  if (existing.status !== "draft" && !can(user.role, "pages:publish")) {
    throw new ApiError("FORBIDDEN", "Only users who can publish may change a published page");
  }
}

export const GET = handle(async (_req, ctx: Ctx) => {
  await requireUser("pages:read");
  return ok(await getPage((await ctx.params).id));
});

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireUser("pages:write");
  const id = (await ctx.params).id;
  const { baseUpdatedAt, ...input } = updatePageSchema.parse(await readJson(req));
  await assertMayChange(user, id);
  const { page, previousSlug } = await updatePage(id, input, baseUpdatedAt);
  invalidatePages(page.slug, previousSlug);
  return ok(page);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser("pages:write");
  const id = (await ctx.params).id;
  await assertMayChange(user, id);
  const { slug } = await deletePage(id);
  invalidatePages(slug);
  return ok({ deleted: true });
});
