import { ApiError, handle, ok, readJson } from "@/server/api";
import { clientIp, rateLimitShared } from "@/server/rate-limit";
import { placeOrder } from "@/server/services/orders";
import { checkoutSchema, idempotencyKeySchema } from "@/lib/validation/orders";

// Guest checkout. `Idempotency-Key` makes retries safe: the same key returns the same order and never takes stock twice.
export const POST = handle(async (req) => {
  await rateLimitShared(`checkout:${clientIp(req)}`, 10, 60_000);
  const key = idempotencyKeySchema.safeParse(req.headers.get("idempotency-key") ?? "");
  if (!key.success) throw new ApiError("VALIDATION_ERROR", "A valid Idempotency-Key header is required", { "Idempotency-Key": key.error.issues[0]?.message ?? "Required" });
  const { created, ...order } = await placeOrder(checkoutSchema.parse(await readJson(req)), key.data);
  return ok(order, { status: created ? 201 : 200 });
});
