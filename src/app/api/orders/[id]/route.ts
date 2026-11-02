import { handle, ok } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { getCustomerOrder } from "@/server/services/orders";

type Ctx = RouteContext<"/api/orders/[id]">;

// Guest confirmation view, gated by the order's secret token (?token=). Wrong token and unknown order look the same.
export const GET = handle(async (req, ctx: Ctx) => {
  rateLimit(`order-view:${clientIp(req)}`, 60, 60_000);
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const res = ok(await getCustomerOrder((await ctx.params).id, token));
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
});
