import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { changeStatus } from "@/server/services/orders";
import { statusChangeSchema } from "@/lib/validation/orders";

export const PATCH = handle(async (req, ctx: RouteContext<"/api/admin/orders/[id]/status">) => {
  const user = await requireUser("orders:write");
  const { status, note } = statusChangeSchema.parse(await readJson(req));
  return ok(await changeStatus((await ctx.params).id, status, note, { id: String(user._id), name: user.name }));
});
