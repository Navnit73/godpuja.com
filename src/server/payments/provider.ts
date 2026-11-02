import crypto from "node:crypto";
import { ApiError } from "../api";
import { env } from "../env";
import type { OrderDoc } from "../models/Order";

/**
 * Payment gateway adapter slot. The owner has not chosen a gateway yet, so only `cod` (cash on delivery) exists.
 * To add a gateway: implement this interface in a new file, register it in PROVIDERS below, add its id to
 * PAYMENT_METHODS in lib/validation/orders.ts, and map its webhook payload onto the generic event shape handled in
 * services/payments.ts (or add a provider-specific route that does the same after verifying its own signature).
 */
export interface PaymentProvider {
  id: string;
  /** Called inside the checkout transaction after the order document is built (not yet saved). */
  createPayment(order: Pick<OrderDoc, "orderNumber" | "pricing" | "email">): Promise<{ providerOrderId?: string; status: "pending" | "paid" }>;
}

const cod: PaymentProvider = {
  id: "cod",
  // Cash on delivery: nothing to create; payment stays pending until an admin marks it paid.
  createPayment: async () => ({ status: "pending" }),
};

const PROVIDERS: Record<string, PaymentProvider> = { cod };
export function getProvider(method: string): PaymentProvider {
  const p = PROVIDERS[method];
  if (!p) throw new ApiError("VALIDATION_ERROR", "Unsupported payment method", { paymentMethod: "Choose a payment method" });
  return p;
}

// ---------- generic signed webhook ----------
export const WEBHOOK_TOLERANCE_MS = 5 * 60_000;

export function webhookSecret(): string {
  const s = env().PAYMENT_WEBHOOK_SECRET;
  if (!s || s.length < 16) throw new ApiError("NOT_CONFIGURED", "Payment webhook is not configured");
  return s;
}

export const signWebhook = (rawBody: string | Uint8Array, secret: string) => crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

/** Constant-time check of the hex HMAC in `x-signature` over the raw request body. */
export function verifyWebhookSignature(rawBody: Uint8Array, signature: string | null, secret: string): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const a = Buffer.from(signWebhook(rawBody, secret), "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Replay protection: the signed event must carry a timestamp within ±5 minutes of now. */
export function withinTolerance(ts: number | string, now = Date.now()): boolean {
  const ms = typeof ts === "number" ? (ts < 1e12 ? ts * 1000 : ts) : Date.parse(ts);
  return Number.isFinite(ms) && Math.abs(now - ms) <= WEBHOOK_TOLERANCE_MS;
}
