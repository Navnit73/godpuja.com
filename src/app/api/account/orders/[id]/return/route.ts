import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { rateLimitShared } from "@/server/rate-limit";
import { getMyOrder } from "@/server/services/account";
import { requestReturn } from "@/server/services/fulfilment";
import { returnRequestSchema } from "@/lib/validation/orders";

export const POST = handle(async (req, ctx: RouteContext<"/api/account/orders/[id]/return">) => {
  const user = await requireUser();
  const id = (await ctx.params).id;
  await rateLimitShared(`order-return:${String(user._id)}`, 10, 15 * 60_000);
  const { reason } = returnRequestSchema.parse(await readJson(req));
  await requestReturn(String(user._id), user.name, id, reason);
  return ok(await getMyOrder(String(user._id), id), { status: 201 });
});
