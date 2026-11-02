import { ApiError, handle, ok } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { getPublicProduct } from "@/server/public/catalog";

type Ctx = RouteContext<"/api/products/[slug]">;

export const GET = handle(async (req, ctx: Ctx) => {
  rateLimit(`product:${clientIp(req)}`, 120, 60_000);
  const slug = (await ctx.params).slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new ApiError("NOT_FOUND", "Product not found");
  const p = await getPublicProduct(slug);
  if (!p) throw new ApiError("NOT_FOUND", "Product not found");
  return ok(p);
});
