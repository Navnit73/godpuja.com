import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { refundOrder } from "@/server/services/orders";
import { refundSchema } from "@/lib/validation/orders";

// Records a refund against the order (no gateway call is made in this release).
export const POST = handle(async (req, ctx: RouteContext<"/api/admin/orders/[id]/refund">) => {
  const user = await requireUser("orders:refund");
  const { amount, reason } = refundSchema.parse(await readJson(req));
  return ok(await refundOrder((await ctx.params).id, amount, reason, { id: String(user._id), name: user.name }), { status: 201 });
});
