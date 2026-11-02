import mongoose, { type Model } from "mongoose";

export const ORDER_STATUSES = ["confirmed", "processing", "shipped", "delivered", "cancelled", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type Address = { name: string; line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
export type OrderItem = {
  product: mongoose.Types.ObjectId; variantSku: string | null; name: string; slug: string; sku: string; image: { url: string; alt: string } | null;
  options: Record<string, string>; unitPrice: number; qty: number; lineTotal: number;
};
export type Actor = { id: string | null; name: string };
export type HistoryEntry = { kind: "created" | "status" | "payment" | "refund" | "note" | "webhook"; status: OrderStatus; note: string; by: Actor; at: Date };

export type OrderDoc = {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  idempotencyKey: string;
  requestHash: string;
  accessToken: string;
  email: string;
  phone: string;
  shippingAddress: Address;
  billingAddress: Address;
  customerNote: string;
  items: OrderItem[];
  pricing: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  status: OrderStatus;
  payment: { provider: string; method: string; providerOrderId?: string; providerPaymentId?: string; status: PaymentStatus; paidAt?: Date };
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
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    shippingAddress: { type: M, required: true },
    billingAddress: { type: M, required: true },
    customerNote: { type: String, default: "", maxlength: 300 },
    items: { type: M, required: true },
    pricing: { type: M, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "confirmed" },
    payment: {
      provider: { type: String, required: true },
      method: { type: String, required: true },
      providerOrderId: String,
      providerPaymentId: String,
      status: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
      paidAt: Date,
    },
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
orderSchema.index({ createdAt: -1, _id: -1 });
// Sparse (not partial): equality lookups from webhooks must be able to use them.
orderSchema.index({ "payment.providerPaymentId": 1 }, { unique: true, sparse: true });
orderSchema.index({ "payment.providerOrderId": 1 }, { sparse: true });

if (process.env.NODE_ENV !== "production") delete mongoose.models.Order;
export const Order: Model<OrderDoc> = (mongoose.models.Order as Model<OrderDoc>) || mongoose.model<OrderDoc>("Order", orderSchema as never);
