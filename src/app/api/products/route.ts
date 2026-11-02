import { handle, ok } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { findPublicProducts } from "@/server/services/products";
import { publicProductsSchema } from "@/lib/validation/catalog";

// Uncached (the parameter space is unbounded) but index-backed, bounded and rate limited.
export const GET = handle(async (req) => {
  rateLimit(`products:${clientIp(req)}`, 120, 60_000);
  const { items, ...meta } = await findPublicProducts(publicProductsSchema.parse(Object.fromEntries(new URL(req.url).searchParams)));
  return ok(items, { meta });
});
