import mongoose, { type Model } from "mongoose";
import type { Address } from "@/lib/address";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/order-status";

export { ORDER_STATUSES, PAYMENT_STATUSES };
export type { Address, OrderStatus, PaymentStatus };
export type OrderItem = {
  product: mongoose.Types.ObjectId; variantSku: string | null; name: string; slug: string; sku: string; image: { url: string; alt: string } | null;
  options: Record<string, string>; unitPrice: number; qty: number; lineTotal: number;
};
export type Actor = { id: string | null; name: string };
export type HistoryEntry = { kind: "created" | "status" | "payment" | "refund" | "note" | "webhook" | "shipment" | "return"; status: OrderStatus; note: string; by: Actor; at: Date };

export type Shipment = { id: string; carrier: string; trackingNumber: string; trackingUrl: string | null; shippedAt: Date; by: Actor };
/** `source` is who raised it. `status` moves requested -> accepted | declined (staff decision); a declined order cannot be re-requested by the customer. */
export type ReturnRequest = { reason: string; at: Date; status: "requested" | "accepted" | "declined"; source: "customer" | "staff"; decidedAt?: Date; decisionNote?: string };

export type OrderDoc = {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  idempotencyKey: string;
  requestHash: string;
  accessToken: string;
  /** Owning customer account (signed-in checkout, or a guest order claimed after the email was verified). */
  user: mongoose.Types.ObjectId | null;
  email: string;
  phone: string;
  shippingAddress: Address;
  billingAddress: Address;
  customerNote: string;
  items: OrderItem[];
  /** ISO 4217 code all amounts on this order are in (integer minor units). Missing on pre-Stage-12 rows = INR. */
  currency: string;
  /** All amounts are integer minor units of `currency`. total = subtotal − discount + shipping (+ tax when it is added on top). */
  pricing: { subtotal: number; discount: number; shipping: number; tax: number; total: number; taxName?: string; taxRateBps?: number; taxInclusive?: boolean };
  /** The coupon applied at checkout (a snapshot: it stays correct if the coupon is later edited or deleted). */
  coupon?: { id: mongoose.Types.ObjectId; code: string; type: string; discount: number };
  status: OrderStatus;
  payment: { provider: string; method: string; providerOrderId?: string; providerPaymentId?: string; status: PaymentStatus; paidAt?: Date };
  shipments: Shipment[];
  /** When the order was marked delivered; starts the return window. */
  deliveredAt?: Date;
  returnRequest?: ReturnRequest;
  refunds: { amount: number; reason: string; at: Date; by: Actor }[];
  refundedTotal: number;
  notes: { text: string; by: Actor; at: Date }[];
  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
};

// Embedded documents are plain data (shape enforced by zod at the boundary and by the service that builds them).
const M = mongoose.Schema.Types.Mixed;
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: true, unique: true },
    requestHash: { type: String, required: true },
    accessToken: { type: String, required: true, unique: true }, // 192-bit random; the only credential for guests
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    shippingAddress: { type: M, required: true },
    billingAddress: { type: M, required: true },
    customerNote: { type: String, default: "", maxlength: 300 },
    items: { type: M, required: true },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    pricing: { type: M, required: true },
    coupon: { type: M },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    payment: {
      provider: { type: String, required: true },
      method: { type: String, required: true },
      providerOrderId: String,
      providerPaymentId: String,
      status: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
      paidAt: Date,
    },
    shipments: { type: M, default: [] },
    deliveredAt: Date,
    returnRequest: { type: M },
    refunds: { type: M, default: [] },
    refundedTotal: { type: Number, default: 0, min: 0 },
    notes: { type: M, default: [] },
    history: { type: M, default: [] },
  },
  { timestamps: true, minimize: false },
);
// Indexes end in _id so the admin list sort (createdAt desc, _id desc) is served from the index, no in-memory sort.
orderSchema.index({ status: 1, createdAt: -1, _id: -1 });
orderSchema.index({ "payment.status": 1, createdAt: -1, _id: -1 });
orderSchema.index({ email: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1, _id: -1 }, { partialFilterExpression: { user: { $type: "objectId" } } });
orderSchema.index({ createdAt: -1, _id: -1 });
// Sparse (not partial): equality lookups from webhooks must be able to use them.
orderSchema.index({ "payment.providerPaymentId": 1 }, { unique: true, sparse: true });
orderSchema.index({ "payment.providerOrderId": 1 }, { sparse: true });

if (process.env.NODE_ENV !== "production") delete mongoose.models.Order;
export const Order: Model<OrderDoc> = (mongoose.models.Order as Model<OrderDoc>) || mongoose.model<OrderDoc>("Order", orderSchema as never);
