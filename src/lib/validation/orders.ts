import { z } from "zod";
import { addressIssues } from "@/lib/address";
import { ADMIN_SETTABLE_STATUSES, ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/order-status";

export const MAX_LINE_QTY = 20;
export const MAX_CART_LINES = 30;
/** Payment methods a customer can choose. Add a provider id here when its adapter ships (see server/payments). */
export const PAYMENT_METHODS = ["cod"] as const;

const sku = z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9][A-Z0-9._-]*$/);

export const cartLineSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/, "Invalid product"),
  // The browser cart stores null for products without variants; treat null exactly like "absent".
  variantSku: sku.nullish().transform((v) => v ?? undefined).optional(),
  qty: z.number().int("Whole numbers only").min(1).max(MAX_LINE_QTY, `At most ${MAX_LINE_QTY} per item`),
});
export const cartInputSchema = z.object({ items: z.array(cartLineSchema).min(1, "Your cart is empty").max(MAX_CART_LINES, `At most ${MAX_CART_LINES} different items`) });
export type CartLineInput = z.infer<typeof cartLineSchema>;

const phone = z.string().trim().regex(/^\+?[\d\s-]{8,20}$/, "Enter a valid phone number").refine((v) => { const n = v.replace(/\D/g, "").length; return n >= 8 && n <= 15; }, "Enter a valid phone number");
/** International address (PRD v1.1 §13). Postal code and state rules depend on the country (lib/address.ts). */
export const addressSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(100),
  line1: z.string().trim().min(3, "Enter the address").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.string().trim().max(80).default(""),
  postalCode: z.string().trim().toUpperCase().max(12).default(""),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Choose a country"),
}).superRefine((a, ctx) => {
  for (const [path, message] of Object.entries(addressIssues(a))) ctx.addIssue({ code: "custom", path: [path], message });
});
export type AddressInput = z.infer<typeof addressSchema>;

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, "Idempotency-Key must be 8–80 characters: letters, numbers, - and _");

export const checkoutSchema = cartInputSchema.extend({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email")),
  phone,
  shippingAddress: addressSchema,
  billingSameAsShipping: z.boolean(),
  billingAddress: addressSchema.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(300).optional(),
}).superRefine((v, ctx) => {
  if (!v.billingSameAsShipping && !v.billingAddress) ctx.addIssue({ code: "custom", path: ["billingAddress"], message: "Enter the billing address" });
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ---------- admin ----------
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const listOrdersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  payment: z.enum(PAYMENT_STATUSES).optional(),
  from: day.optional(),
  to: day.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(ADMIN_SETTABLE_STATUSES),
  note: z.string().trim().max(500).optional(),
});
export const paymentChangeSchema = z.object({ status: z.enum(["paid", "failed"]) });
export const noteSchema = z.object({ text: z.string().trim().min(1, "Write a note").max(1000) });
export const refundSchema = z.object({
  amount: z.number().int("Amount must be in whole minor units (paise)").min(1, "Enter an amount").max(100_000_000_00),
  reason: z.string().trim().min(2, "Give a reason").max(300),
});

// ---------- generic signed webhook ----------
export const webhookEventSchema = z.object({
  eventId: z.string().trim().min(1).max(100),
  type: z.enum(["payment.succeeded", "payment.failed", "payment.refunded"]),
  timestamp: z.union([z.number(), z.iso.datetime({ offset: true })]), // epoch seconds/ms or ISO; checked against a ±5 min window
  orderNumber: z.string().trim().max(40).optional(),
  providerOrderId: z.string().trim().max(100).optional(),
  providerPaymentId: z.string().trim().max(100).optional(),
  amount: z.number().int().min(1).optional(), // minor units of `currency`
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(), // ISO 4217; must match the order when given
}).refine((e) => e.orderNumber || e.providerOrderId || e.providerPaymentId, { message: "Identify the order", path: ["orderNumber"] });
export type WebhookEventInput = z.infer<typeof webhookEventSchema>;
