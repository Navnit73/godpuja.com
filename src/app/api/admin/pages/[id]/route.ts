import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { invalidatePages } from "@/server/public/pages";
import { deletePage, getPage, updatePage } from "@/server/services/pages";
import { updatePageSchema } from "@/lib/validation/pages";

type Ctx = RouteContext<"/api/admin/pages/[id]">;

// Changing or deleting content that is (or was scheduled to be) public requires publish rights too. The services
// enforce this inside the write (status must still be "draft"), so a page published meanwhile cannot slip through.
const draftOnly = (user: { role: Parameters<typeof can>[0] }) => ({ draftOnly: !can(user.role, "pages:publish") });

export const GET = handle(async (_req, ctx: Ctx) => {
  await requireUser("pages:read");
  return ok(await getPage((await ctx.params).id));
});

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireUser("pages:write");
  const id = (await ctx.params).id;
  const { baseUpdatedAt, ...input } = updatePageSchema.parse(await readJson(req));
  const { page, previousSlug } = await updatePage(id, input, baseUpdatedAt, draftOnly(user));
  invalidatePages(page.slug, previousSlug);
  return ok(page);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser("pages:write");
  const id = (await ctx.params).id;
  const { slug } = await deletePage(id, draftOnly(user));
  invalidatePages(slug);
  return ok({ deleted: true });
});
