import { ApiError, handle, ok, readJson } from "@/server/api";
import { resolveUser } from "@/server/auth/guard";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";
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
  const parsed = checkoutSchema.parse(await readJson(req));
  // A session cookie that no longer resolves (account disabled, signed out everywhere, deleted) must not silently turn
  // into a guest order: the customer believes the order is in their account. Ask them to sign in again instead.
  const raw = req.headers.get("cookie") ?? "";
  const token = raw.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const session = token ? await verifySession(decodeURIComponent(token)) : null;
  const user = session ? await resolveUser(session) : null;
  if (session && !user) throw new ApiError("UNAUTHENTICATED", "Your session has ended. Please sign in again to place this order.");
  const userId = user ? String(user._id) : null;
  if (userId) await rateLimitShared(`checkout-user:${userId}`, 10, 60_000);
  // The account's own email is the customer's identity (receipts, per-customer coupon limits, order lookup): a signed-in
  // customer cannot place an order under another address.
  const input = user ? { ...parsed, email: user.email } : parsed;
  const { created, ...order } = await placeOrder(input, key.data, { userId });
  if (created && userId && input.saveAddress) {
    await saveCheckoutAddress(userId, { ...input.shippingAddress, phone: input.phone }).catch((e) => console.error("[checkout] could not save address", e));
  }
  return ok(order, { status: created ? 201 : 200 });
});
