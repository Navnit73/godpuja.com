import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Order, type Actor, type OrderStatus, type PaymentStatus } from "../models/Order";
import { WebhookEvent } from "../models/WebhookEvent";
import { recordLedger } from "./ledger";
import { defer } from "./notifications";
import { sendOrderRefund, sendOrderStatus } from "./order-notifications";
import { applyRefund, paymentDrivenStatus } from "./orders";
import type { WebhookEventInput } from "@/lib/validation/orders";

const WEBHOOK: Actor = { id: null, name: "Payment webhook" };
const PROVIDER = "generic";

/**
 * Apply a verified payment event. Idempotent on the provider event id (unique index): the event row and the order
 * change commit together, so a duplicate delivery (or a retry after a failure) can never apply twice or be lost.
 */
export async function applyPaymentEvent(ev: WebhookEventInput): Promise<{ duplicate: boolean }> {
  await connectDB();
  const where = ev.orderNumber ? { orderNumber: ev.orderNumber } : ev.providerPaymentId ? { "payment.providerPaymentId": ev.providerPaymentId } : { "payment.providerOrderId": ev.providerOrderId };
  const order = await Order.findOne(where).select("orderNumber pricing currency payment status").lean();
  if (!order) throw new ApiError("NOT_FOUND", "Order not found");
  if (ev.currency && ev.currency !== (order.currency ?? "INR")) {
    throw new ApiError("VALIDATION_ERROR", "Currency does not match the order", { currency: "Mismatch" });
  }
  if (ev.type === "payment.succeeded" && ev.amount !== undefined && ev.amount !== order.pricing.total) {
    throw new ApiError("VALIDATION_ERROR", "Amount does not match the order total", { amount: "Mismatch" });
  }

  const session = await mongoose.startSession();
  // What to tell the customer once the transaction has committed (reset on each transaction retry).
  let after: { status?: OrderStatus; refund?: number } = {};
  try {
    await session.withTransaction(async () => {
      after = {};
      await WebhookEvent.create([{ provider: PROVIDER, eventId: ev.eventId, type: ev.type, order: order._id }], { session }); // E11000 => duplicate
      const at = new Date();
      const hist = (note: string) => ({ kind: "webhook", status: order.status, note, by: WEBHOOK, at });
      // Status moves only from the state we read (compare-and-set); a concurrent admin change keeps its own status.
      const moveStatus = async (outcome: "paid" | "failed", note: string) => {
        const next = paymentDrivenStatus(order.status, outcome);
        if (next === order.status) return;
        const moved = await Order.updateOne({ _id: order._id, status: order.status }, { $set: { status: next }, $push: { history: { kind: "status", status: next, note, by: WEBHOOK, at } } }, { session });
        if (moved.modifiedCount) after.status = next;
      };
      if (ev.type === "payment.succeeded") {
        const res = await Order.updateOne(
          { _id: order._id, "payment.status": { $in: ["pending", "failed"] satisfies PaymentStatus[] } },
          { $set: { "payment.status": "paid", "payment.paidAt": at, ...(ev.providerPaymentId ? { "payment.providerPaymentId": ev.providerPaymentId } : {}) }, $push: { history: hist("Payment received") } },
          { session },
        );
        if (res.modifiedCount) {
          await recordLedger({
            kind: "order", refId: order._id, refNumber: order.orderNumber, type: "charge", provider: order.payment.provider, method: order.payment.method,
            providerRef: ev.providerPaymentId ?? null, amount: order.pricing.total, currency: order.currency ?? "INR", note: `Webhook ${ev.eventId}`, actor: WEBHOOK,
          }, session);
          await moveStatus("paid", "Payment received");
        }
      } else if (ev.type === "payment.failed") {
        const res = await Order.updateOne({ _id: order._id, "payment.status": "pending" }, { $set: { "payment.status": "failed" }, $push: { history: hist("Payment failed") } }, { session });
        if (res.modifiedCount) await moveStatus("failed", "Payment failed");
      } else {
        after.refund = await applyRefund(String(order._id), ev.amount, "Refund reported by payment provider", WEBHOOK, session);
      }
    });
    const id = String(order._id), notice = after;
    if (notice.status) defer(() => sendOrderStatus(id, notice.status!));
    if (notice.refund) defer(() => sendOrderRefund(id, notice.refund!));
    return { duplicate: false };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const seen = await WebhookEvent.exists({ provider: PROVIDER, eventId: ev.eventId });
      if (seen) return { duplicate: true };
      throw new ApiError("CONFLICT", "This payment reference is already attached to another order");
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
