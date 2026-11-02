import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { getAdminOrder } from "@/server/services/orders";

export const GET = handle(async (_req, ctx: RouteContext<"/api/admin/orders/[id]">) => {
  await requireUser("orders:read");
  return ok(await getAdminOrder((await ctx.params).id));
});
