import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { removeShipment } from "@/server/services/fulfilment";

export const DELETE = handle(async (_req, ctx: RouteContext<"/api/admin/orders/[id]/shipments/[sid]">) => {
  const user = await requireUser("orders:write");
  const { id, sid } = await ctx.params;
  return ok(await removeShipment(id, sid, { id: String(user._id), name: user.name }));
});
