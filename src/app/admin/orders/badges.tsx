import type { OrderStatus, PaymentStatus } from "@/server/models/Order";

export const STATUS_LABEL: Record<OrderStatus, string> = { confirmed: "Confirmed", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", returned: "Returned" };
export const PAYMENT_LABEL: Record<PaymentStatus, string> = { pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded", partially_refunded: "Partly refunded" };

export function StatusBadge({ status }: { status: OrderStatus }) {
  const cls = status === "delivered" ? "badge-success" : status === "cancelled" || status === "returned" ? "badge-danger" : status === "confirmed" ? "badge-muted" : "badge-primary";
  return <span className={cls}>{STATUS_LABEL[status]}</span>;
}
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const cls = status === "paid" ? "badge-success" : status === "failed" ? "badge-danger" : status === "pending" ? "badge-muted" : "badge-primary";
  return <span className={cls}>{PAYMENT_LABEL[status]}</span>;
}
