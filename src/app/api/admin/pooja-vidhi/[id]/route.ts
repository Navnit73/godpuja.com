import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { invalidateVidhi } from "@/server/public/vidhi";
import { deleteVidhi, getVidhi, updateVidhi } from "@/server/services/vidhi";
import { updateVidhiSchema } from "@/lib/validation/vidhi";

type Ctx = RouteContext<"/api/admin/pooja-vidhi/[id]">;
// Changing or deleting something that is (or was scheduled to be) public needs publish rights; enforced inside the write.
const draftOnly = (user: { role: Parameters<typeof can>[0] }) => ({ draftOnly: !can(user.role, "vidhi:publish") });

export const GET = handle(async (_req, ctx: Ctx) => {
  await requireUser("vidhi:read");
  return ok(await getVidhi((await ctx.params).id));
});

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireUser("vidhi:write");
  const id = (await ctx.params).id;
  const { baseUpdatedAt, ...input } = updateVidhiSchema.parse(await readJson(req));
  const { vidhi, previousSlug } = await updateVidhi(id, input, baseUpdatedAt, draftOnly(user));
  invalidateVidhi(vidhi.slug, previousSlug);
  return ok(vidhi);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser("vidhi:write");
  const { slug } = await deleteVidhi((await ctx.params).id, draftOnly(user));
  invalidateVidhi(slug);
  return ok({ deleted: true });
});
