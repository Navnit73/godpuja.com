import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { invalidateDevotional } from "@/server/public/devotional";
import { invalidateVidhi } from "@/server/public/vidhi";
import { deleteDevotional, getDevotional, updateDevotional } from "@/server/services/devotional";
import { updateDevotionalSchema } from "@/lib/validation/devotional";

type Ctx = RouteContext<"/api/admin/aarti-mantras/[id]">;
// Changing or deleting something that is (or was scheduled to be) public needs publish rights; enforced inside the write.
const draftOnly = (user: { role: Parameters<typeof can>[0] }) => ({ draftOnly: !can(user.role, "devotional:publish") });

export const GET = handle(async (_req, ctx: Ctx) => {
  await requireUser("devotional:read");
  return ok(await getDevotional((await ctx.params).id));
});

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireUser("devotional:write");
  const { baseUpdatedAt, ...input } = updateDevotionalSchema.parse(await readJson(req));
  const { item, previousHref } = await updateDevotional((await ctx.params).id, input, baseUpdatedAt, draftOnly(user));
  invalidateDevotional(item.slug, previousHref.split("/").pop());
  invalidateVidhi(); // guides list their related aarti
  return ok(item);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser("devotional:write");
  const { slug } = await deleteDevotional((await ctx.params).id, draftOnly(user));
  invalidateDevotional(slug);
  invalidateVidhi();
  return ok({ deleted: true });
});
