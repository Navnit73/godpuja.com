// Shared (client + server safe). Order and payment states, PRD v1.1 §5.4.

/**
 * `pending_payment` / `payment_failed` are for online gateways: such an order is never shown as confirmed until the
 * payment succeeds. Cash on delivery confirms on placement (payment stays `pending` until cash is recorded).
 * `refunded` is set automatically when a cancelled or returned order is refunded in full.
 */
export const ORDER_STATUSES = [
  "pending_payment", "payment_failed", "confirmed", "processing", "shipped", "delivered", "return_requested", "returned", "cancelled", "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Statuses an admin can move an order to by hand. Payment-driven moves (pending_payment → confirmed etc.) happen via payment updates. */
export const ADMIN_SETTABLE_STATUSES = ["processing", "shipped", "delivered", "return_requested", "returned", "cancelled"] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment", payment_failed: "Payment failed", confirmed: "Confirmed", processing: "Processing", shipped: "Shipped",
  delivered: "Delivered", return_requested: "Return requested", returned: "Returned", cancelled: "Cancelled", refunded: "Refunded",
};
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded", partially_refunded: "Partly refunded",
};

/** An invoice exists once an order is confirmed (so not while unpaid or after a plain cancellation). */
export const invoiceable = (s: OrderStatus) => !["pending_payment", "payment_failed", "cancelled"].includes(s);
