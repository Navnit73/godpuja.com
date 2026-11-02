import { ApiError, handle, ok } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { findRelated } from "@/server/services/products";

type Ctx = RouteContext<"/api/products/[slug]/related">;

export const GET = handle(async (req, ctx: Ctx) => {
  rateLimit(`related:${clientIp(req)}`, 120, 60_000);
  const slug = (await ctx.params).slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new ApiError("NOT_FOUND", "Product not found");
  return ok(await findRelated(slug));
});
