import { ApiError, handle, ok, readJson } from "@/server/api";
import { userFromRequest } from "@/server/auth/guard";
import { clientIp, rateLimitShared } from "@/server/rate-limit";
import { saveCheckoutAddress } from "@/server/services/account";
import { placeOrder } from "@/server/services/orders";
import { checkoutSchema, idempotencyKeySchema } from "@/lib/validation/orders";

// Guest or signed-in checkout. `Idempotency-Key` makes retries safe: the same key returns the same order and never
// takes stock twice. A signed-in customer's order is linked to the account; `saveAddress` stores the shipping address.
export const POST = handle(async (req) => {
  await rateLimitShared(`checkout:${clientIp(req)}`, 10, 60_000);
  const key = idempotencyKeySchema.safeParse(req.headers.get("idempotency-key") ?? "");
  if (!key.success) throw new ApiError("VALIDATION_ERROR", "A valid Idempotency-Key header is required", { "Idempotency-Key": key.error.issues[0]?.message ?? "Required" });
  const input = checkoutSchema.parse(await readJson(req));
  const user = await userFromRequest(req);
  const userId = user ? String(user._id) : null;
  const { created, ...order } = await placeOrder(input, key.data, { userId });
  if (created && userId && input.saveAddress) {
    await saveCheckoutAddress(userId, { ...input.shippingAddress, phone: input.phone }).catch((e) => console.error("[checkout] could not save address", e));
  }
  return ok(order, { status: created ? 201 : 200 });
});
