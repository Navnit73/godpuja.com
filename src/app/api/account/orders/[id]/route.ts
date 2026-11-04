import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { getMyOrder } from "@/server/services/account";

export const GET = handle(async (_req, ctx: RouteContext<"/api/account/orders/[id]">) => {
  const user = await requireUser();
  const res = ok(await getMyOrder(String(user._id), (await ctx.params).id));
  res.headers.set("Cache-Control", "private, no-store");
  return res;
});
