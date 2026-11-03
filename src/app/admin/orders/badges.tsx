import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus, type PaymentStatus } from "@/lib/order-status";

export const STATUS_LABEL = ORDER_STATUS_LABEL;
export const PAYMENT_LABEL = PAYMENT_STATUS_LABEL;

export function StatusBadge({ status }: { status: OrderStatus }) {
  const cls = status === "delivered" ? "badge-success"
    : status === "cancelled" || status === "returned" || status === "payment_failed" || status === "refunded" ? "badge-danger"
    : status === "confirmed" || status === "pending_payment" ? "badge-muted" : "badge-primary";
  return <span className={cls}>{STATUS_LABEL[status]}</span>;
}
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const cls = status === "paid" ? "badge-success" : status === "failed" ? "badge-danger" : status === "pending" ? "badge-muted" : "badge-primary";
  return <span className={cls}>{PAYMENT_LABEL[status]}</span>;
}
