import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { addShipment } from "@/server/services/fulfilment";
import { shipmentSchema } from "@/lib/validation/orders";

export const POST = handle(async (req, ctx: RouteContext<"/api/admin/orders/[id]/shipments">) => {
  const user = await requireUser("orders:write");
  const input = shipmentSchema.parse(await readJson(req));
  return ok(await addShipment((await ctx.params).id, input, { id: String(user._id), name: user.name }), { status: 201 });
});
