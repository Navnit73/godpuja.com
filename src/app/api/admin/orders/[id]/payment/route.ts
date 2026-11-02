import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { changePayment } from "@/server/services/orders";
import { paymentChangeSchema } from "@/lib/validation/orders";

export const PATCH = handle(async (req, ctx: RouteContext<"/api/admin/orders/[id]/payment">) => {
  const user = await requireUser("orders:write");
  const { status } = paymentChangeSchema.parse(await readJson(req));
  return ok(await changePayment((await ctx.params).id, status, { id: String(user._id), name: user.name }));
});
