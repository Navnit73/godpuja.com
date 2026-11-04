import crypto from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Counter } from "../models/Counter";
import { env } from "../env";
import { Order, type Actor, type Address, type OrderDoc, type OrderItem, type OrderStatus, type PaymentStatus } from "../models/Order";
import { Product } from "../models/Product";
import { getProvider } from "../payments/provider";
import { CART_FIELDS, computePricing, hiddenCategorySet, mergeLines, resolveLines } from "./cart";
import { ledgerFor, recordLedger, type LedgerRow } from "./ledger";
import { defer } from "./notifications";
import { sendOrderPlaced, sendOrderRefund, sendOrderStatus } from "./order-notifications";
import { countryName, normalizeAddress } from "@/lib/address";
import { BASE_CURRENCY, formatMoney, minorToDecimal } from "@/lib/money";
import { dayRangeUtc } from "@/lib/time";
import type { CheckoutInput, ListOrdersInput } from "@/lib/validation/orders";

const SYSTEM: Actor = { id: null, name: "System" };
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isId = (id: string) => mongoose.isValidObjectId(id);
const dupKey = (e: unknown) => (e as { code?: number })?.code === 11000;
const iso = (d?: Date | null) => (d ? d.toISOString() : null);

// ---------- order numbers ----------
/** GP-YYMM-NNNNNN. One atomic $inc per month; a number may be skipped if a checkout later fails, never reused. */
export async function nextOrderNumber(now = new Date()) {
  const ym = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const c = await Counter.findOneAndUpdate({ _id: `order-${ym}` }, { $inc: { n: 1 } }, { upsert: true, returnDocument: "after" }).lean();
      return `GP-${ym}-${String(c!.n).padStart(6, "0")}`;
    } catch (err) {
      if (dupKey(err) && attempt < 3) continue; // two first-ever upserts of the same counter raced
      throw err;
    }
  }
}

// ---------- checkout ----------
export type CheckoutResult = {
  orderId: string; orderNumber: string; accessToken: string; status: OrderStatus; currency: string; payment: { method: string; status: PaymentStatus }; created: boolean;
};

function hashRequest(input: CheckoutInput) {
  const items = mergeLines(input.items).map((i) => `${i.productId}:${i.variantSku ?? ""}:${i.qty}`).sort();
  return crypto.createHash("sha256").update(JSON.stringify([items, input.email, input.phone, input.shippingAddress, input.billingSameAsShipping, input.billingAddress ?? null, input.paymentMethod, input.notes ?? ""])).digest("hex");
}

function replayOf(existing: OrderDoc, requestHash: string): CheckoutResult {
  if (existing.requestHash !== requestHash) {
    throw new ApiError("CONFLICT", "This Idempotency-Key was already used for a different order. Generate a new key for a new checkout.");
  }
  return { orderId: String(existing._id), orderNumber: existing.orderNumber, accessToken: existing.accessToken, status: existing.status, currency: currencyOf(existing), payment: { method: existing.payment.method, status: existing.payment.status }, created: false };
}

const addr = (a: CheckoutInput["shippingAddress"]): Address => ({ name: a.name, line1: a.line1, ...(a.line2 ? { line2: a.line2 } : {}), city: a.city, state: a.state, postalCode: a.postalCode, country: a.country });
/** Orders from before Stage 12 have no currency field: they were all INR. */
const currencyOf = (o: Pick<OrderDoc, "currency">) => o.currency ?? "INR";

/** Countries we deliver to (env SHIPPING_COUNTRIES). Billing addresses may be anywhere. */
export const shippingCountries = () => env().SHIPPING_COUNTRIES;
export function assertShippable(country: string) {
  if (shippingCountries().includes(country)) return;
  const name = countryName(country) ?? country;
  throw new ApiError("VALIDATION_ERROR", `We do not deliver to ${name} yet.`, { "shippingAddress.country": `We do not deliver to ${name} yet` });
}

/**
 * Place an order. Everything that must be consistent happens in ONE transaction: re-price from the database,
 * decrement stock with an in-update guard (`stock >= qty`), create the order. Any failure (including a lost race for the
 * last unit) aborts the whole transaction, so stock is never partially taken. A retry with the same Idempotency-Key
 * returns the original order without touching stock again.
 */
export async function placeOrder(input: CheckoutInput, idempotencyKey: string, opts: { userId?: string | null } = {}): Promise<CheckoutResult> {
  assertShippable(input.shippingAddress.country);
  await connectDB();
  const requestHash = hashRequest(input);
  const prior = await Order.findOne({ idempotencyKey }).lean();
  if (prior) return replayOf(prior, requestHash);

  const merged = mergeLines(input.items);
  const orderNumber = await nextOrderNumber();
  const accessToken = crypto.randomBytes(24).toString("base64url");
  const provider = getProvider(input.paymentMethod);
  const hidden = await hiddenCategorySet();
  const session = await mongoose.startSession();
  try {
    let result!: CheckoutResult;
    await session.withTransaction(async () => {
      // On a transient retry the callback re-runs from scratch; a competing request with the same key may have won.
      const existing = await Order.findOne({ idempotencyKey }).session(session).lean();
      if (existing) { result = replayOf(existing, requestHash); return; }

      const rows = await Product.find({ _id: { $in: [...new Set(merged.map((i) => i.productId))] } }).session(session).select(CART_FIELDS).lean();
      const products = new Map(rows.map((r) => [String(r._id), r as never]));
      const { lines, issues } = resolveLines(merged, products, hidden);
      if (issues.length) {
        const first = issues[0];
        const name = lines.find((l) => l.productId === first.productId && l.variantSku === first.variantSku)?.name ?? "An item";
        throw new ApiError("CONFLICT", `${name}: ${first.message} Please review your cart.`, { items: first.message });
      }

      for (const l of lines) {
        const res = l.variantSku && rows.find((r) => String(r._id) === l.productId)?.variants?.length
          ? await Product.updateOne({ _id: l.productId, status: "active", variants: { $elemMatch: { sku: l.variantSku, stock: { $gte: l.qty } } } }, { $inc: { "variants.$.stock": -l.qty, soldCount: l.qty } }, { session, timestamps: false })
          : await Product.updateOne({ _id: l.productId, status: "active", stock: { $gte: l.qty } }, { $inc: { stock: -l.qty, soldCount: l.qty } }, { session, timestamps: false });
        if (res.matchedCount === 0) throw new ApiError("CONFLICT", `${l.name} just sold out or has less stock than you asked for. Please review your cart.`, { items: "Stock changed" });
      }

      const pricing = computePricing(lines);
      const items: OrderItem[] = lines.map((l) => ({
        product: new mongoose.Types.ObjectId(l.productId), variantSku: l.variantSku, name: l.name, slug: l.slug, sku: l.sku, image: l.image, options: l.options,
        unitPrice: l.unitPrice, qty: l.qty, lineTotal: l.lineTotal,
      }));
      const shipping = addr(input.shippingAddress);
      const currency = BASE_CURRENCY;
      const pay = await provider.createPayment({ orderNumber, currency, pricing: { subtotal: pricing.subtotal, discount: 0, shipping: pricing.shipping, tax: 0, total: pricing.total }, email: input.email });
      const status: OrderStatus = pay.status === "paid" || provider.confirmsOnPlacement ? "confirmed" : "pending_payment";
      const now = new Date();
      const [doc] = await Order.create([{
        orderNumber, idempotencyKey, requestHash, accessToken, user: opts.userId && isId(opts.userId) ? new mongoose.Types.ObjectId(opts.userId) : null, email: input.email, phone: input.phone, shippingAddress: shipping,
        billingAddress: input.billingSameAsShipping || !input.billingAddress ? shipping : addr(input.billingAddress), customerNote: input.notes ?? "",
        items, currency, pricing: { subtotal: pricing.subtotal, discount: 0, shipping: pricing.shipping, tax: 0, total: pricing.total }, status,
        payment: { provider: provider.id, method: input.paymentMethod, ...(pay.providerOrderId ? { providerOrderId: pay.providerOrderId } : {}), status: pay.status, ...(pay.status === "paid" ? { paidAt: now } : {}) },
        history: [{ kind: "created", status, note: status === "pending_payment" ? "Order placed, awaiting payment" : "Order placed", by: SYSTEM, at: now }],
      }], { session });
      const o = doc.toObject() as OrderDoc;
      result = { orderId: String(o._id), orderNumber: o.orderNumber, accessToken: o.accessToken, status: o.status, currency: o.currency, payment: { method: o.payment.method, status: o.payment.status }, created: true };
    });
    if (result.created) defer(() => sendOrderPlaced(result.orderId));
    return result;
  } catch (err) {
    if (dupKey(err)) {
      // Same key submitted twice at the same instant: the other request committed first.
      const won = await Order.findOne({ idempotencyKey }).lean();
      if (won) return replayOf(won, requestHash);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

// ---------- customer view (guest token) ----------
export type CustomerOrder = {
  orderNumber: string; status: OrderStatus; createdAt: string; email: string; phone: string; currency: string;
  items: { name: string; sku: string; variantSku: string | null; options: Record<string, string>; image: { url: string; alt: string } | null; slug: string; unitPrice: number; qty: number; lineTotal: number }[];
  pricing: OrderDoc["pricing"]; payment: { method: string; status: PaymentStatus }; shippingAddress: Address; billingAddress: Address;
};

const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/** Token-gated confirmation view. A wrong token and a missing order are indistinguishable (404). */
export async function getCustomerOrder(id: string, token: string): Promise<CustomerOrder> {
  const notFound = new ApiError("NOT_FOUND", "Order not found");
  if (!isId(id) || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw notFound;
  await connectDB();
  const o = await Order.findById(id).select("orderNumber status createdAt email phone items currency pricing payment shippingAddress billingAddress accessToken").lean();
  if (!o || !safeEqual(o.accessToken, token)) throw notFound;
  return customerView(o);
}

/** What a customer may see of their order: no notes, history, refunds or internal ids. */
export function customerView(o: Pick<OrderDoc, "orderNumber" | "status" | "createdAt" | "email" | "phone" | "items" | "currency" | "pricing" | "payment" | "shippingAddress" | "billingAddress">): CustomerOrder {
  return {
    orderNumber: o.orderNumber, status: o.status, createdAt: o.createdAt.toISOString(), email: o.email, phone: o.phone, currency: currencyOf(o),
    items: o.items.map((i) => ({ name: i.name, sku: i.sku, variantSku: i.variantSku, options: i.options, image: i.image, slug: i.slug, unitPrice: i.unitPrice, qty: i.qty, lineTotal: i.lineTotal })),
    pricing: o.pricing, payment: { method: o.payment.method, status: o.payment.status }, shippingAddress: normalizeAddress(o.shippingAddress), billingAddress: normalizeAddress(o.billingAddress),
  };
}

// ---------- admin ----------
export type AdminOrder = Omit<OrderDoc, "_id" | "user" | "accessToken" | "requestHash" | "idempotencyKey" | "createdAt" | "updatedAt" | "payment" | "history" | "refunds" | "notes" | "items"> & {
  id: string; user: string | null; createdAt: string; updatedAt: string; ledger: LedgerRow[];
  items: (Omit<OrderItem, "product"> & { product: string })[];
  payment: { provider: string; method: string; providerOrderId: string | null; providerPaymentId: string | null; status: PaymentStatus; paidAt: string | null };
  refunds: { amount: number; reason: string; at: string; by: Actor }[];
  notes: { text: string; by: Actor; at: string }[];
  history: { kind: string; status: OrderStatus; note: string; by: Actor; at: string }[];
  allowedNext: OrderStatus[]; refundable: number;
};
export type OrderListItem = { id: string; orderNumber: string; createdAt: string; status: OrderStatus; paymentStatus: PaymentStatus; currency: string; total: number; itemCount: number; name: string; email: string };

/**
 * Status moves an admin may make by hand. Cancelling is only possible before shipping and returns the stock.
 * Not listed here because they are driven by payment updates (changePayment / webhook) or refunds:
 * pending_payment|payment_failed → confirmed (payment received), pending_payment → payment_failed,
 * cancelled|returned → refunded (refunded in full).
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["cancelled"],
  payment_failed: ["cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["return_requested", "returned"],
  return_requested: ["returned", "delivered"], // delivered = return declined
  returned: [],
  cancelled: [],
  refunded: [],
};

const toAdmin = (o: OrderDoc, ledger: LedgerRow[]): AdminOrder => ({
  id: String(o._id), user: o.user ? String(o.user) : null, ledger, orderNumber: o.orderNumber, email: o.email, phone: o.phone, shippingAddress: normalizeAddress(o.shippingAddress), billingAddress: normalizeAddress(o.billingAddress),
  customerNote: o.customerNote ?? "", currency: currencyOf(o), pricing: o.pricing, status: o.status, refundedTotal: o.refundedTotal ?? 0,
  createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
  items: o.items.map((i) => ({ ...i, product: String(i.product) })),
  payment: { provider: o.payment.provider, method: o.payment.method, providerOrderId: o.payment.providerOrderId ?? null, providerPaymentId: o.payment.providerPaymentId ?? null, status: o.payment.status, paidAt: iso(o.payment.paidAt) },
  refunds: (o.refunds ?? []).map((r) => ({ ...r, at: new Date(r.at).toISOString() })),
  notes: (o.notes ?? []).map((n) => ({ ...n, at: new Date(n.at).toISOString() })),
  history: (o.history ?? []).map((h) => ({ ...h, at: new Date(h.at).toISOString() })),
  allowedNext: TRANSITIONS[o.status] ?? [],
  refundable: ["paid", "partially_refunded"].includes(o.payment.status) ? o.pricing.total - (o.refundedTotal ?? 0) : 0,
});

export function buildOrderFilter(q: Pick<ListOrdersInput, "q" | "status" | "payment" | "from" | "to">) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.payment) filter["payment.status"] = q.payment;
  if (q.from || q.to) {
    // Whole local days in the admin time zone (env ADMIN_TIMEZONE, default Asia/Kolkata).
    const tz = env().ADMIN_TIMEZONE;
    filter.createdAt = { ...(q.from ? { $gte: dayRangeUtc(q.from, tz).start } : {}), ...(q.to ? { $lte: dayRangeUtc(q.to, tz).end } : {}) };
  }
  if (q.q) {
    const t = q.q.trim();
    const or: Record<string, unknown>[] = [
      { orderNumber: { $regex: `^${escapeRegex(t.toUpperCase())}` } }, // anchored: uses the unique index
      { email: { $regex: `^${escapeRegex(t.toLowerCase())}` } }, // anchored: uses {email, createdAt}
      { "shippingAddress.name": { $regex: escapeRegex(t), $options: "i" } },
    ];
    const digits = t.replace(/\D/g, "");
    if (digits.length >= 4) or.push({ phone: { $regex: digits.split("").join("[\\s-]*") } }); // digits only, so nothing to escape; tolerates spaces/dashes in stored numbers
    filter.$or = or;
  }
  return filter;
}

export async function listOrders(q: ListOrdersInput) {
  await connectDB();
  const filter = buildOrderFilter(q);
  const [rows, total] = await Promise.all([
    Order.find(filter).select("orderNumber createdAt status payment.status currency pricing.total items.qty shippingAddress.name email").sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Order.countDocuments(filter),
  ]);
  const items: OrderListItem[] = rows.map((o) => ({
    id: String(o._id), orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), status: o.status, paymentStatus: o.payment.status, currency: currencyOf(o), total: o.pricing.total,
    itemCount: o.items.reduce((n, i) => n + i.qty, 0), name: o.shippingAddress.name, email: o.email,
  }));
  return { items, total, page: q.page, limit: q.limit, pages: Math.max(1, Math.ceil(total / q.limit)) };
}

export async function getAdminOrder(id: string): Promise<AdminOrder> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const [o, ledger] = await Promise.all([Order.findById(id).lean(), ledgerFor("order", id)]);
  if (!o) throw new ApiError("NOT_FOUND", "Order not found");
  return toAdmin(o, ledger);
}

const entry = (kind: OrderDoc["history"][number]["kind"], status: OrderStatus, note: string, by: Actor) => ({ kind, status, note, by, at: new Date() });

async function missingOrConflict(id: string, message: string): Promise<never> {
  if (!(await Order.exists({ _id: id }))) throw new ApiError("NOT_FOUND", "Order not found");
  throw new ApiError("CONFLICT", message);
}

/** Put a cancelled order's units back. Missing products/variants (deleted since) are skipped. */
async function restoreStock(items: OrderItem[], session: ClientSession) {
  for (const i of items) {
    if (i.variantSku) await Product.updateOne({ _id: i.product, "variants.sku": i.variantSku }, { $inc: { "variants.$.stock": i.qty, soldCount: -i.qty } }, { session, timestamps: false });
    else await Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty, soldCount: -i.qty } }, { session, timestamps: false });
  }
}

/**
 * Move an order along TRANSITIONS. The change is a compare-and-set on the status we validated against, so two admins
 * (or a double click) cannot both apply. Cancelling also restores stock in the same transaction, exactly once.
 */
export async function changeStatus(id: string, to: OrderStatus, note: string | undefined, actor: Actor): Promise<AdminOrder> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const cur = await Order.findById(id).select("status").lean();
  if (!cur) throw new ApiError("NOT_FOUND", "Order not found");
  if (!TRANSITIONS[cur.status].includes(to)) throw new ApiError("CONFLICT", `An order that is ${cur.status} cannot be changed to ${to}.`);
  const update = (from: OrderStatus) => ({ filter: { _id: id, status: from }, set: { $set: { status: to }, $push: { history: entry("status", to, note ?? "", actor) } } });

  if (to !== "cancelled") {
    const u = update(cur.status);
    const res = await Order.updateOne(u.filter, u.set);
    if (res.matchedCount === 0) await missingOrConflict(id, "This order was just changed by someone else. Reload and try again.");
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const u = update(cur.status);
        const o = await Order.findOneAndUpdate(u.filter, u.set, { session, returnDocument: "before" }).select("items").lean();
        if (!o) throw new ApiError("CONFLICT", "This order was just changed by someone else. Reload and try again.");
        await restoreStock(o.items, session);
      });
    } finally {
      await session.endSession();
    }
  }
  defer(() => sendOrderStatus(id, to));
  return getAdminOrder(id);
}

/** Run `fn` in a transaction (or inside the caller's). */
async function inTx<T>(session: ClientSession | undefined, fn: (s: ClientSession) => Promise<T>): Promise<T> {
  if (session) return fn(session);
  const s = await mongoose.startSession();
  try {
    let out!: T;
    await s.withTransaction(async () => { out = await fn(s); });
    return out;
  } finally {
    await s.endSession();
  }
}

/**
 * An admin records a payment outcome (COD cash received, a failed attempt, or a gateway payment confirmed by hand).
 * Marking paid confirms an order that was waiting for payment; marking failed moves pending_payment to payment_failed.
 * Paid can only be undone through a refund.
 */
export async function changePayment(id: string, to: "paid" | "failed", actor: Actor): Promise<AdminOrder> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const from: PaymentStatus[] = to === "paid" ? ["pending", "failed"] : ["pending"];
  // The history entry records the order status at the time of the payment change, so the write is a
  // compare-and-set on that status (a concurrent status change makes this one report a conflict).
  const cur = await Order.findById(id).select("status orderNumber currency pricing.total payment.provider payment.method").lean();
  if (!cur) throw new ApiError("NOT_FOUND", "Order not found");
  const refused = `Payment cannot be marked ${to} for this order (it may be cancelled, already paid, or changed by someone else).`;
  if (cur.status === "cancelled" || cur.status === "refunded") throw new ApiError("CONFLICT", refused);
  const next = paymentDrivenStatus(cur.status, to);
  const at = new Date();
  const history: OrderDoc["history"] = [{ kind: "payment", status: cur.status, note: `Payment marked ${to}`, by: actor, at }];
  if (next !== cur.status) history.push({ kind: "status", status: next, note: to === "paid" ? "Payment received" : "Payment failed", by: actor, at });
  // Order change and ledger row commit together (PRD v1.1 §14.1).
  await inTx(undefined, async (session) => {
    const res = await Order.updateOne(
      { _id: id, status: cur.status, "payment.status": { $in: from } },
      { $set: { "payment.status": to, status: next, ...(to === "paid" ? { "payment.paidAt": at } : {}) }, $push: { history: { $each: history } } },
      { session },
    );
    if (res.matchedCount === 0) {
      if (!(await Order.exists({ _id: id }).session(session))) throw new ApiError("NOT_FOUND", "Order not found");
      throw new ApiError("CONFLICT", refused);
    }
    if (to === "paid") {
      await recordLedger({
        kind: "order", refId: id, refNumber: cur.orderNumber, type: "charge", provider: cur.payment.provider, method: cur.payment.method,
        amount: cur.pricing.total, currency: currencyOf(cur), note: "Recorded by admin", actor,
      }, session);
    }
  });
  if (next !== cur.status) defer(() => sendOrderStatus(id, next));
  return getAdminOrder(id);
}

/** Order status after a payment outcome: payment confirms an order that was waiting for it; a failure is recorded on pending_payment. */
export function paymentDrivenStatus(status: OrderStatus, outcome: "paid" | "failed"): OrderStatus {
  if (outcome === "paid") return status === "pending_payment" || status === "payment_failed" ? "confirmed" : status;
  return status === "pending_payment" ? "payment_failed" : status;
}

export async function addNote(id: string, text: string, actor: Actor): Promise<AdminOrder> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const at = new Date();
  const res = await Order.updateOne({ _id: id }, { $push: { notes: { text, by: actor, at } } });
  if (res.matchedCount === 0) throw new ApiError("NOT_FOUND", "Order not found");
  return getAdminOrder(id);
}

/**
 * Record a refund (no gateway call). Compare-and-set loop on `refundedTotal`: concurrent refunds cannot together
 * exceed the order total, because each write only applies if nobody changed the refunded amount since it was read.
 * `amount` omitted = refund whatever remains. A cancelled or returned order refunded in full moves to `refunded`.
 */
export async function refundOrder(id: string, amount: number | undefined, reason: string, actor: Actor): Promise<AdminOrder> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const refunded = await inTx(undefined, (s) => applyRefund(id, amount, reason, actor, s));
  defer(() => sendOrderRefund(id, refunded));
  return getAdminOrder(id);
}

/** The refund write + its ledger row inside the caller's transaction (admin refund, payment webhook). Returns the amount refunded. */
export async function applyRefund(id: string, amount: number | undefined, reason: string, actor: Actor, session: ClientSession): Promise<number> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const o = await Order.findById(id).session(session).select("orderNumber pricing currency payment status refundedTotal").lean();
    if (!o) throw new ApiError("NOT_FOUND", "Order not found");
    if (!["paid", "partially_refunded"].includes(o.payment.status)) throw new ApiError("CONFLICT", "Only paid orders can be refunded.");
    const refunded = o.refundedTotal ?? 0;
    const remaining = o.pricing.total - refunded;
    const amt = amount ?? remaining;
    const cur = currencyOf(o);
    if (amt < 1 || amt > remaining) throw new ApiError("VALIDATION_ERROR", `You can refund at most ${formatMoney(remaining, cur)} on this order.`, { amount: "More than the refundable amount" });
    const newTotal = refunded + amt;
    const payStatus: PaymentStatus = newTotal === o.pricing.total ? "refunded" : "partially_refunded";
    const closes = payStatus === "refunded" && (o.status === "cancelled" || o.status === "returned");
    const at = new Date();
    const history: OrderDoc["history"] = [{ kind: "refund", status: o.status, note: `Refunded ${formatMoney(amt, cur)}: ${reason}`, by: actor, at }];
    if (closes) history.push({ kind: "status", status: "refunded", note: "Refunded in full", by: actor, at });
    const res = await Order.updateOne(
      // Compare-and-set on the refunded amount AND the status, so a concurrent cancel/return is never overwritten.
      { _id: id, status: o.status, refundedTotal: refunded, "payment.status": { $in: ["paid", "partially_refunded"] } },
      { $set: { refundedTotal: newTotal, "payment.status": payStatus, ...(closes ? { status: "refunded" } : {}) }, $push: { refunds: { amount: amt, reason, at, by: actor }, history: { $each: history } } },
      { session },
    );
    if (res.matchedCount === 1) {
      await recordLedger({
        kind: "order", refId: id, refNumber: o.orderNumber, type: "refund", provider: o.payment.provider, method: o.payment.method,
        amount: amt, currency: cur, note: reason, actor,
      }, session);
      return amt;
    }
  }
  throw new ApiError("CONFLICT", "This order is being updated right now. Try again.");
}

// ---------- CSV export ----------
const FORMULA = /^[=+\-@\t\r]/;
/** CSV cell with RFC-4180 quoting and a leading apostrophe on anything a spreadsheet could execute as a formula. */
export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const EXPORT_COLUMNS = ["Order", "Placed (UTC)", "Status", "Payment", "Name", "Email", "Phone", "City", "State", "Postal code", "Country", "Items", "Currency", "Subtotal", "Shipping", "Total", "Refunded"] as const;
export const EXPORT_LIMIT = 5000;

export async function* exportOrderRows(q: Pick<ListOrdersInput, "q" | "status" | "payment" | "from" | "to">): AsyncGenerator<string> {
  await connectDB();
  yield EXPORT_COLUMNS.map(csvCell).join(",") + "\r\n";
  const cursor = Order.find(buildOrderFilter(q)).sort({ createdAt: -1, _id: -1 }).limit(EXPORT_LIMIT).lean().cursor();
  for await (const o of cursor) {
    const a = normalizeAddress(o.shippingAddress), cur = currencyOf(o), amt = (n: number) => minorToDecimal(n, cur);
    yield [
      o.orderNumber, o.createdAt.toISOString(), o.status, o.payment.status, a.name, o.email, o.phone, a.city, a.state, a.postalCode, a.country,
      o.items.map((i) => `${i.name}${i.variantSku ? ` [${i.variantSku}]` : ""} x${i.qty}`).join("; "), cur, amt(o.pricing.subtotal), amt(o.pricing.shipping), amt(o.pricing.total), amt(o.refundedTotal ?? 0),
    ].map(csvCell).join(",") + "\r\n";
  }
}
