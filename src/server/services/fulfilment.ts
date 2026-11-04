import crypto from "node:crypto";
import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { env } from "../env";
import { Order, type Actor, type OrderDoc } from "../models/Order";
import type { ShipmentInput } from "@/lib/validation/orders";
import { defer } from "./notifications";
import { sendOrderShipment, sendReturnRequested } from "./order-notifications";
import { changeStatus, getAdminOrder, type AdminOrder } from "./orders";

const isId = (id: string) => mongoose.isValidObjectId(id);
const DAY = 86_400_000;

// ---------- shipments (admin) ----------
/** Orders that can carry tracking: being prepared, on the way, or delivered (a late correction). */
const SHIPPABLE: OrderDoc["status"][] = ["processing", "shipped", "delivered"];

/** Add a carrier + tracking number. The status is not changed (mark as shipped separately); the customer is emailed the tracking details. */
export async function addShipment(id: string, input: ShipmentInput, actor: Actor): Promise<AdminOrder> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const at = new Date();
  const shipment = { id: crypto.randomUUID(), carrier: input.carrier, trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl || null, shippedAt: at, by: actor };
  const res = await Order.updateOne(
    { _id: id, status: { $in: SHIPPABLE }, "shipments.trackingNumber": { $ne: input.trackingNumber } },
    { $push: { shipments: shipment, history: { kind: "shipment", status: "processing", note: `Tracking added: ${input.carrier} ${input.trackingNumber}`, by: actor, at } } },
  );
  if (res.matchedCount === 0) {
    const o = await Order.findById(id).select("status shipments").lean();
    if (!o) throw new ApiError("NOT_FOUND", "Order not found");
    if (o.shipments?.some((s) => s.trackingNumber === input.trackingNumber)) throw new ApiError("CONFLICT", "This tracking number is already on the order.", { trackingNumber: "Already added" });
    throw new ApiError("CONFLICT", `Tracking can be added while an order is being processed or shipped (this one is ${o.status.replace(/_/g, " ")}).`);
  }
  defer(() => sendOrderShipment(id));
  return getAdminOrder(id);
}

/** Remove a wrongly entered shipment. No email is sent. */
export async function removeShipment(id: string, shipmentId: string, actor: Actor): Promise<AdminOrder> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const res = await Order.updateOne(
    { _id: id, "shipments.id": shipmentId },
    { $pull: { shipments: { id: shipmentId } }, $push: { history: { kind: "shipment", status: "processing", note: "Tracking removed", by: actor, at: new Date() } } },
  );
  if (res.matchedCount === 0) throw new ApiError("NOT_FOUND", "Shipment not found");
  return getAdminOrder(id);
}

// ---------- customer actions ----------
export const CANCELLABLE: OrderDoc["status"][] = ["pending_payment", "payment_failed", "confirmed"];

export type OrderActions = { canCancel: boolean; canReturn: boolean; returnDeadline: string | null };

/** What the owner may still do, from the order as it is now. Policy: cancel before processing starts; return within RETURN_WINDOW_DAYS of delivery, once. */
export function orderActions(o: Pick<OrderDoc, "status" | "deliveredAt" | "returnRequest">, now = Date.now()): OrderActions {
  const days = env().RETURN_WINDOW_DAYS;
  const deadline = o.deliveredAt ? new Date(new Date(o.deliveredAt).getTime() + days * DAY) : null;
  const open = !!deadline && days > 0 && now <= deadline.getTime();
  return {
    canCancel: CANCELLABLE.includes(o.status),
    canReturn: o.status === "delivered" && !o.returnRequest && open,
    returnDeadline: o.status === "delivered" && !o.returnRequest && deadline && days > 0 ? deadline.toISOString() : null,
  };
}

const owned = async (userId: string, orderId: string) => {
  if (!isId(orderId)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const o = await Order.findOne({ _id: orderId, user: new mongoose.Types.ObjectId(userId) }).select("status deliveredAt returnRequest").lean();
  if (!o) throw new ApiError("NOT_FOUND", "Order not found"); // someone else's order is indistinguishable from a missing one
  return o;
};

/** Customer cancels their own order before it is processed. Stock goes back (same transaction as admin cancel). */
export async function cancelMyOrder(userId: string, userName: string, orderId: string) {
  const o = await owned(userId, orderId);
  if (!CANCELLABLE.includes(o.status)) throw new ApiError("CONFLICT", "This order can no longer be cancelled online. Please contact us.");
  return changeStatus(orderId, "cancelled", "Cancelled by the customer", { id: userId, name: userName });
}

/** Customer asks to return a delivered order. Once per order; staff then accept or decline. */
export async function requestReturn(userId: string, userName: string, orderId: string, reason: string) {
  const o = await owned(userId, orderId);
  const a = orderActions(o);
  if (!a.canReturn) {
    if (o.returnRequest) throw new ApiError("CONFLICT", o.returnRequest.status === "declined" ? "Your return request was already reviewed. Please contact us." : "A return has already been requested for this order.");
    if (o.status !== "delivered") throw new ApiError("CONFLICT", "Returns can only be requested after delivery.");
    throw new ApiError("CONFLICT", `The ${env().RETURN_WINDOW_DAYS}-day return period for this order has ended. Please contact us.`);
  }
  const at = new Date();
  const res = await Order.updateOne(
    { _id: orderId, user: new mongoose.Types.ObjectId(userId), status: "delivered", returnRequest: { $exists: false } },
    { $set: { status: "return_requested", returnRequest: { reason, at, status: "requested", source: "customer" } }, $push: { history: { kind: "return", status: "return_requested", note: reason, by: { id: userId, name: userName }, at } } },
  );
  if (res.matchedCount === 0) throw new ApiError("CONFLICT", "This order was just changed. Reload and try again.");
  defer(() => sendReturnRequested(orderId));
}
