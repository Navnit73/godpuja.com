import { env } from "../env";
import { Order } from "../models/Order";
import * as T from "../email/templates";
import { normalizeAddress } from "@/lib/address";
import { trackingLink } from "@/lib/carriers";
import type { OrderStatus } from "@/lib/order-status";
import { deliver, siteName } from "./notifications";

/** The order link in emails: the token page works for guests and signed-in customers alike. */
const orderUrl = (id: string, token: string) => `${env().SITE_URL}/order/${id}/confirmation?token=${encodeURIComponent(token)}`;

async function load(id: string) {
  const o = await Order.findById(id).select("orderNumber email accessToken status currency items pricing coupon shippingAddress payment.method").lean();
  if (!o) return null;
  return { o, url: orderUrl(id, o.accessToken), site: await siteName(), ref: { kind: "order", id } };
}

export async function sendOrderPlaced(id: string) {
  const x = await load(id);
  if (!x) return;
  const { o } = x;
  await deliver(T.orderPlaced(x.site, o.email, {
    orderNumber: o.orderNumber, currency: o.currency ?? "INR", status: o.status, items: o.items, pricing: o.pricing, couponCode: o.coupon?.code ?? null,
    shippingAddress: normalizeAddress(o.shippingAddress), paymentMethod: o.payment.method,
  }, x.url), "order.placed", x.ref);
}

export async function sendOrderStatus(id: string, status: OrderStatus) {
  if (!T.NOTIFIED_STATUSES.includes(status)) return;
  const x = await load(id);
  if (!x) return;
  await deliver(T.orderStatus(x.site, x.o.email, x.o.orderNumber, status, x.url), `order.status.${status}`, x.ref);
}

export async function sendOrderShipment(id: string) {
  const o = await Order.findById(id).select("orderNumber email accessToken shipments").lean();
  if (!o || !o.shipments?.length) return;
  const shipments = o.shipments.map((s) => ({ carrier: s.carrier, trackingNumber: s.trackingNumber, link: trackingLink(s.carrier, s.trackingNumber, s.trackingUrl) }));
  await deliver(T.orderShipment(await siteName(), o.email, o.orderNumber, shipments, orderUrl(id, o.accessToken)), "order.shipment", { kind: "order", id });
}

export async function sendReturnRequested(id: string) {
  const x = await load(id);
  if (x) await deliver(T.returnRequested(x.site, x.o.email, x.o.orderNumber, x.url), "order.return_requested", x.ref);
}

export async function sendReturnDecision(id: string, decision: "accepted" | "declined", note: string) {
  const x = await load(id);
  if (x) await deliver(T.returnDecision(x.site, x.o.email, x.o.orderNumber, decision, note, x.url), `order.return_${decision}`, x.ref);
}

export async function sendOrderRefund(id: string, amount: number) {
  const x = await load(id);
  if (!x) return;
  await deliver(T.orderRefund(x.site, x.o.email, x.o.orderNumber, amount, x.o.currency ?? "INR", x.url), "order.refund", x.ref);
}
