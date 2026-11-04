import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { rateLimitShared } from "@/server/rate-limit";
import { invalidateProducts } from "@/server/public/catalog";
import { getMyOrder } from "@/server/services/account";
import { cancelMyOrder } from "@/server/services/fulfilment";

// Cancelling returns the stock, so the storefront's in-stock badges for these products are refreshed.
export const POST = handle(async (_req, ctx: RouteContext<"/api/account/orders/[id]/cancel">) => {
  const user = await requireUser();
  const id = (await ctx.params).id;
  await rateLimitShared(`order-cancel:${String(user._id)}`, 10, 15 * 60_000);
  const order = await cancelMyOrder(String(user._id), user.name, id);
  invalidateProducts(...order.items.map((i) => i.slug));
  return ok(await getMyOrder(String(user._id), id));
});
