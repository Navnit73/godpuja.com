import { ApiError, handle, ok, readLimited } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { verifyWebhookSignature, webhookSecret, withinTolerance } from "@/server/payments/provider";
import { applyPaymentEvent } from "@/server/services/payments";
import { webhookEventSchema } from "@/lib/validation/orders";

// Generic signed webhook: header `x-signature` = hex HMAC-SHA256 of the RAW body with PAYMENT_WEBHOOK_SECRET.
// Verified before the body is parsed; signed events older/newer than 5 minutes are rejected (replay); duplicates return 200.
export const POST = handle(async (req) => {
  rateLimit(`webhook:${clientIp(req)}`, 120, 60_000);
  const secret = webhookSecret();
  const raw = await readLimited(req, 64_000);
  if (!verifyWebhookSignature(raw, req.headers.get("x-signature"), secret)) throw new ApiError("UNAUTHENTICATED", "Invalid signature");
  let json: unknown;
  try { json = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new ApiError("VALIDATION_ERROR", "Body must be valid JSON"); }
  const event = webhookEventSchema.parse(json);
  if (!withinTolerance(event.timestamp)) throw new ApiError("VALIDATION_ERROR", "Event timestamp is outside the allowed window");
  const { duplicate } = await applyPaymentEvent(event);
  return ok({ received: true, duplicate });
});
