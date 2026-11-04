import { addressLines, type Address } from "@/lib/address";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import type { OutgoingEmail } from "./send";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plain, accessible layout: one column, real text (no image-only content), a single button. */
function layout(site: string, heading: string, paragraphs: string[], cta?: { label: string; url: string }, extraHtml = "") {
  const ps = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5">${esc(p)}</p>`).join("");
  const button = cta ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#9a3412;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${esc(cta.label)}</a></p><p style="margin:0 0 14px;font-size:13px;color:#57534e">Or open this link: <a href="${esc(cta.url)}" style="color:#9a3412">${esc(cta.url)}</a></p>` : "";
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f7f3ea;font-family:Inter,Arial,sans-serif;color:#292820"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><p style="font-size:20px;font-weight:600;margin:0 0 24px">${esc(site)}</p><h1 style="font-size:22px;margin:0 0 16px">${esc(heading)}</h1>${ps}${extraHtml}${button}<p style="margin:32px 0 0;font-size:12px;color:#78716c">You received this email because of an action on ${esc(site)}. If it was not you, you can ignore it.</p></div></body></html>`;
}
const text = (heading: string, paragraphs: string[], cta?: { label: string; url: string }, extra: string[] = []) =>
  [heading, "", ...paragraphs, ...(extra.length ? ["", ...extra] : []), ...(cta ? ["", `${cta.label}: ${cta.url}`] : [])].join("\n");

export function verifyEmail(site: string, to: string, name: string, url: string): OutgoingEmail {
  const h = "Confirm your email address";
  const p = [`Namaste ${name},`, "Please confirm this is your email address. The link works once and expires in 24 hours."];
  const cta = { label: "Confirm email", url };
  return { to, subject: `${h} — ${site}`, html: layout(site, h, p, cta), text: text(h, p, cta) };
}

export function passwordReset(site: string, to: string, name: string, url: string): OutgoingEmail {
  const h = "Reset your password";
  const p = [`Namaste ${name},`, "We received a request to reset your password. The link works once and expires in 1 hour. Resetting signs you out on every device."];
  const cta = { label: "Choose a new password", url };
  return { to, subject: `${h} — ${site}`, html: layout(site, h, p, cta), text: text(h, p, cta) };
}

type OrderSummary = {
  orderNumber: string; currency: string; items: { name: string; qty: number; lineTotal: number }[];
  pricing: { subtotal: number; shipping: number; total: number }; shippingAddress: Address; paymentMethod: string;
};
function orderTable(o: OrderSummary) {
  const m = (n: number) => esc(formatMoney(n, o.currency));
  const rows = o.items.map((i) => `<tr><td style="padding:6px 0">${esc(i.name)} × ${i.qty}</td><td style="padding:6px 0;text-align:right">${m(i.lineTotal)}</td></tr>`).join("");
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px">${rows}<tr><td style="padding:6px 0;border-top:1px solid #d6c3a1">Shipping</td><td style="padding:6px 0;border-top:1px solid #d6c3a1;text-align:right">${o.pricing.shipping === 0 ? "Free" : m(o.pricing.shipping)}</td></tr><tr><td style="padding:6px 0;font-weight:600">Total (${esc(o.currency)})</td><td style="padding:6px 0;text-align:right;font-weight:600">${m(o.pricing.total)}</td></tr></table><p style="margin:0 0 14px;font-size:14px;line-height:1.5"><strong>Delivering to</strong><br>${addressLines(o.shippingAddress).map(esc).join("<br>")}</p>`;
}
const orderText = (o: OrderSummary) => [
  ...o.items.map((i) => `${i.name} x ${i.qty}: ${formatMoney(i.lineTotal, o.currency)}`),
  `Shipping: ${o.pricing.shipping === 0 ? "Free" : formatMoney(o.pricing.shipping, o.currency)}`,
  `Total (${o.currency}): ${formatMoney(o.pricing.total, o.currency)}`, "", "Delivering to:", ...addressLines(o.shippingAddress),
];

export function orderPlaced(site: string, to: string, o: OrderSummary & { status: OrderStatus }, url: string): OutgoingEmail {
  const awaiting = o.status === "pending_payment";
  const h = awaiting ? `Order ${o.orderNumber} is waiting for payment` : `Thank you for your order ${o.orderNumber}`;
  const p = [
    awaiting ? "Your order is not confirmed until the payment succeeds." : "We have received your order and will let you know when it ships.",
    o.paymentMethod === "cod" ? "Payment: cash on delivery." : `Payment: ${o.paymentMethod}.`,
  ];
  const cta = { label: "View your order", url };
  return { to, subject: `${h} — ${site}`, html: layout(site, h, p, cta, orderTable(o)), text: text(h, p, cta, orderText(o)) };
}

const STATUS_COPY: Partial<Record<OrderStatus, string>> = {
  confirmed: "Your payment was received and your order is confirmed.",
  shipped: "Your order is on its way.",
  delivered: "Your order has been delivered. We hope it serves your puja well.",
  cancelled: "Your order has been cancelled. If you paid online, any refund will follow our refund policy.",
  returned: "We have received your return.",
  refunded: "Your order has been refunded in full.",
};
export const NOTIFIED_STATUSES = Object.keys(STATUS_COPY) as OrderStatus[];

export function orderStatus(site: string, to: string, orderNumber: string, status: OrderStatus, url: string, note = ""): OutgoingEmail {
  const h = `Order ${orderNumber}: ${ORDER_STATUS_LABEL[status]}`;
  const p = [STATUS_COPY[status] ?? `Your order is now ${ORDER_STATUS_LABEL[status].toLowerCase()}.`, ...(note ? [note] : [])];
  const cta = { label: "View your order", url };
  return { to, subject: `${h} — ${site}`, html: layout(site, h, p, cta), text: text(h, p, cta) };
}

export function orderRefund(site: string, to: string, orderNumber: string, amount: number, currency: string, url: string): OutgoingEmail {
  const h = `Refund for order ${orderNumber}`;
  const p = [`We have issued a refund of ${formatMoney(amount, currency)}. Depending on your payment method it can take a few days to reach you.`];
  const cta = { label: "View your order", url };
  return { to, subject: `${h} — ${site}`, html: layout(site, h, p, cta), text: text(h, p, cta) };
}
