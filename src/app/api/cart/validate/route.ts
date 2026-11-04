import { handle, ok, readJson } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { validateCart } from "@/server/services/cart";
import { quoteSchema } from "@/lib/validation/orders";

// Public. Recomputes prices, availability and quantities from the database; nothing from the browser is trusted.
export const POST = handle(async (req) => {
  rateLimit(`cart:${clientIp(req)}`, 60, 60_000);
  const { items, couponCode, country } = quoteSchema.parse(await readJson(req));
  return ok(await validateCart(items, { couponCode, country }));
});
