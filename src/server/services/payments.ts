import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Order, type Actor, type PaymentStatus } from "../models/Order";
import { WebhookEvent } from "../models/WebhookEvent";
import { refundOrder } from "./orders";
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
  const order = await Order.findOne(where).select("pricing payment status").lean();
  if (!order) throw new ApiError("NOT_FOUND", "Order not found");
  if (ev.type === "payment.succeeded" && ev.amount !== undefined && ev.amount !== order.pricing.total) {
    throw new ApiError("VALIDATION_ERROR", "Amount does not match the order total", { amount: "Mismatch" });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await WebhookEvent.create([{ provider: PROVIDER, eventId: ev.eventId, type: ev.type, order: order._id }], { session }); // E11000 => duplicate
      const at = new Date();
      const hist = (note: string) => ({ kind: "webhook", status: order.status, note, by: WEBHOOK, at });
      if (ev.type === "payment.succeeded") {
        await Order.updateOne(
          { _id: order._id, "payment.status": { $in: ["pending", "failed"] satisfies PaymentStatus[] } },
          { $set: { "payment.status": "paid", "payment.paidAt": at, ...(ev.providerPaymentId ? { "payment.providerPaymentId": ev.providerPaymentId } : {}) }, $push: { history: hist("Payment received") } },
          { session },
        );
      } else if (ev.type === "payment.failed") {
        await Order.updateOne({ _id: order._id, "payment.status": "pending" }, { $set: { "payment.status": "failed" }, $push: { history: hist("Payment failed") } }, { session });
      } else {
        await refundOrder(String(order._id), ev.amount, "Refund reported by payment provider", WEBHOOK, session);
      }
    });
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
