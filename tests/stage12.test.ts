// Stage 12 — global-ready foundations (PRD v1.1 §5.4, §12, §13, §15.1).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

process.env.PAYMENT_WEBHOOK_SECRET ??= "test-webhook-secret-0123456789";

import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { Category } from "@/server/models/Category";
import { Counter } from "@/server/models/Counter";
import { Order } from "@/server/models/Order";
import { Product } from "@/server/models/Product";
import { User } from "@/server/models/User";
import { WebhookEvent } from "@/server/models/WebhookEvent";
import { createProduct } from "@/server/services/products";
import {
  assertShippable, changePayment, changeStatus, exportOrderRows, getAdminOrder, getCustomerOrder, listOrders, paymentDrivenStatus, placeOrder, refundOrder, TRANSITIONS,
} from "@/server/services/orders";
import { applyPaymentEvent } from "@/server/services/payments";
import { createUser, listUsers, updateUser } from "@/server/services/users";
import { resolveUser } from "@/server/auth/guard";
import { can, PERMISSIONS } from "@/server/auth/permissions";
import { assertTempleAccess, canAccessTemple, templeFilter } from "@/server/auth/scope";
import { signSession, verifySession } from "@/server/auth/session";
import { addressIssues, addressLines, allCountries, countryName, isCountry, normalizeAddress } from "@/lib/address";
import { BASE_CURRENCY, formatMoney, isCurrency, minorDigits, minorToDecimal } from "@/lib/money";
import { ADMIN_SETTABLE_STATUSES, ORDER_STATUS_LABEL, ORDER_STATUSES } from "@/lib/order-status";
import { isTempleScoped, LEGACY_ROLES, normalizeRole, ROLE_LABELS, ROLES } from "@/lib/roles";
import { dayRangeUtc, formatInZone, isTimeZone, localDay, nextDay, zonedToUtc } from "@/lib/time";
import { emptySeo } from "@/lib/validation/pages";
import { checkoutSchema, listOrdersSchema, statusChangeSchema, webhookEventSchema } from "@/lib/validation/orders";
import { createUserSchema, updateUserSchema } from "@/lib/validation/users";
import type { ProductInput } from "@/lib/validation/catalog";

const ACTOR = { id: null, name: "Tester" };
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};

// ---------------------------------------------------------------- pure helpers
describe("money (ISO 4217, integer minor units)", () => {
  it("formats by currency with the right number of minor digits", () => {
    expect(BASE_CURRENCY).toBe("INR");
    expect(minorDigits("INR")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("KWD")).toBe(3);
    expect(formatMoney(19950)).toBe("₹199.50");
    expect(formatMoney(10000000)).toBe("₹1,00,000"); // Indian grouping for rupees
    expect(formatMoney(1999, "USD")).toBe("$19.99");
    expect(formatMoney(500, "JPY")).toBe("¥500"); // JPY has no minor unit: 500 means ¥500, not ¥5
    expect(formatMoney(null)).toBe("—");
  });
  it("exports decimals without float drift and validates codes", () => {
    expect(minorToDecimal(25000)).toBe("250.00");
    expect(minorToDecimal(1, "KWD")).toBe("0.001");
    expect(minorToDecimal(7, "JPY")).toBe("7");
    for (const c of ["INR", "USD", "EUR", "GBP"]) expect(isCurrency(c), c).toBe(true);
    for (const c of ["inr", "RUPEE", "", "IN"]) expect(isCurrency(c), c).toBe(false);
  });
});

describe("international addresses", () => {
  it("applies per-country postal and state rules", () => {
    const ok = (country: string, postalCode: string, state = "Somewhere") => Object.keys(addressIssues({ country, postalCode, state })).length === 0;
    expect(ok("IN", "411001")).toBe(true);
    expect(ok("IN", "41100")).toBe(false);
    expect(ok("IN", "411001", "")).toBe(false); // state required in India
    expect(ok("US", "10001")).toBe(true);
    expect(ok("US", "10001-1234")).toBe(true);
    expect(ok("US", "1000")).toBe(false);
    expect(ok("GB", "SW1A 1AA", "")).toBe(true); // county optional
    expect(ok("CA", "K1A 0B1")).toBe(true);
    expect(ok("AU", "2000")).toBe(true);
    expect(ok("AE", "", "Dubai")).toBe(true); // UAE has no postcodes
    expect(ok("FR", "75001", "")).toBe(true); // default rule
    expect(ok("FR", "", "")).toBe(false);
    expect(addressIssues({ country: "ZZ", postalCode: "1", state: "" })).toEqual({ country: "Choose a country" });
    expect(addressIssues({ country: "US", postalCode: "1", state: "" })).toEqual({ postalCode: "Enter a valid ZIP code", state: "Enter the state" });
  });
  it("lists real countries only and names them", () => {
    const list = allCountries();
    const codes = list.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["IN", "US", "GB", "CA", "AU", "AE", "SG", "NP"]));
    for (const bad of ["EU", "UN", "ZZ", "XA", "QO"]) expect(codes, bad).not.toContain(bad);
    expect(list.length).toBeGreaterThan(200);
    expect(isCountry("IN") && !isCountry("in") && !isCountry("EU")).toBe(true);
    expect(countryName("IN")).toBe("India");
  });
  it("reads pre-Stage-12 addresses (pincode, no postalCode) and renders lines", () => {
    const legacy = normalizeAddress({ name: "A", line1: "1 Road", city: "Pune", state: "MH", pincode: "411001", country: "IN" });
    expect(legacy).toEqual({ name: "A", line1: "1 Road", city: "Pune", state: "MH", postalCode: "411001", country: "IN" });
    expect(addressLines(legacy)).toEqual(["A", "1 Road", "Pune, MH 411001", "India"]);
    expect(addressLines({ name: "B", line1: "2 St", city: "Dubai", state: "Dubai", postalCode: "", country: "AE" })).toEqual(["B", "2 St", "Dubai, Dubai", "United Arab Emirates"]);
  });
});

describe("time zones (UTC storage, IANA zones)", () => {
  it("converts local wall time to UTC", () => {
    expect(zonedToUtc("2026-11-03", "06:30", "Asia/Kolkata").toISOString()).toBe("2026-11-03T01:00:00.000Z");
    expect(zonedToUtc("2026-01-15", "09:00", "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z"); // EST
    expect(zonedToUtc("2026-07-15", "09:00", "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z"); // EDT
    expect(zonedToUtc("2026-07-15", "09:00", "Europe/London").toISOString()).toBe("2026-07-15T08:00:00.000Z"); // BST
    expect(() => zonedToUtc("2026-13-01", "09:00", "Asia/Kolkata")).toThrow(RangeError);
    expect(() => zonedToUtc("2026-01-01", "09:00", "Mars/Olympus")).toThrow(RangeError);
  });
  it("covers whole local days, including 23- and 25-hour DST days", () => {
    const ist = dayRangeUtc("2026-11-03", "Asia/Kolkata");
    expect(ist.start.toISOString()).toBe("2026-11-02T18:30:00.000Z");
    expect(ist.end.toISOString()).toBe("2026-11-03T18:29:59.999Z");
    const springForward = dayRangeUtc("2026-03-29", "Europe/London");
    expect(springForward.end.getTime() + 1 - springForward.start.getTime()).toBe(23 * 3600_000);
    const fallBack = dayRangeUtc("2026-10-25", "Europe/London");
    expect(fallBack.end.getTime() + 1 - fallBack.start.getTime()).toBe(25 * 3600_000);
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(localDay(new Date("2026-11-02T19:00:00Z"), "Asia/Kolkata")).toBe("2026-11-03");
    expect(localDay(new Date("2026-11-02T19:00:00Z"), "America/New_York")).toBe("2026-11-02");
  });
  it("validates zones and always labels them", () => {
    expect(isTimeZone("Asia/Kolkata") && isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Asia/Bangalore") || isTimeZone("")).toBe(false);
    expect(formatInZone("2026-11-03T01:00:00Z", "Asia/Kolkata")).toMatch(/6:30.*IST$/i);
    expect(formatInZone("2026-07-15T13:00:00Z", "America/New_York", "en-US")).toMatch(/9:00.*EDT$/);
  });
});

describe("order statuses (PRD v1.1 §5.4)", () => {
  it("has every suggested status and labels for each", () => {
    expect([...ORDER_STATUSES].sort()).toEqual(["cancelled", "confirmed", "delivered", "payment_failed", "pending_payment", "processing", "refunded", "return_requested", "returned", "shipped"]);
    for (const s of ORDER_STATUSES) { expect(ORDER_STATUS_LABEL[s]).toBeTruthy(); expect(TRANSITIONS[s]).toBeDefined(); }
  });
  it("admins cannot hand-set payment-driven statuses", () => {
    for (const s of ["confirmed", "pending_payment", "payment_failed", "refunded"]) expect(statusChangeSchema.safeParse({ status: s }).success, s).toBe(false);
    for (const s of ADMIN_SETTABLE_STATUSES) expect(statusChangeSchema.safeParse({ status: s }).success, s).toBe(true);
    const reachable = new Set(Object.values(TRANSITIONS).flat());
    for (const s of ["confirmed", "pending_payment", "payment_failed", "refunded"]) expect(reachable.has(s as never), s).toBe(false);
  });
  it("only cancels before shipping; returns can be requested and declined", () => {
    expect(TRANSITIONS.pending_payment).toEqual(["cancelled"]);
    expect(TRANSITIONS.payment_failed).toEqual(["cancelled"]);
    expect(TRANSITIONS.return_requested).toEqual(["returned", "delivered"]);
    for (const s of ["shipped", "delivered", "return_requested", "returned", "refunded"] as const) expect(TRANSITIONS[s], s).not.toContain("cancelled");
  });
  it("payment outcomes move only orders waiting for payment", () => {
    expect(paymentDrivenStatus("pending_payment", "paid")).toBe("confirmed");
    expect(paymentDrivenStatus("payment_failed", "paid")).toBe("confirmed");
    expect(paymentDrivenStatus("pending_payment", "failed")).toBe("payment_failed");
    expect(paymentDrivenStatus("confirmed", "paid")).toBe("confirmed"); // COD
    expect(paymentDrivenStatus("cancelled", "paid")).toBe("cancelled");
    expect(paymentDrivenStatus("processing", "failed")).toBe("processing");
  });
  it("list filters accept new statuses; webhook accepts an optional currency", () => {
    expect(listOrdersSchema.parse({ status: "pending_payment" }).status).toBe("pending_payment");
    expect(webhookEventSchema.parse({ eventId: "e", type: "payment.succeeded", timestamp: 1, orderNumber: "X", currency: "inr" }).currency).toBe("INR");
    expect(webhookEventSchema.safeParse({ eventId: "e", type: "payment.succeeded", timestamp: 1, orderNumber: "X", currency: "RUPEES" }).success).toBe(false);
  });
});

describe("roles and temple scope (PRD v1.1 §12)", () => {
  it("has the PRD roles with labels, and maps legacy names", () => {
    expect(ROLES).toEqual(expect.arrayContaining(["superadmin", "store_manager", "content_manager", "temple_ops_manager", "temple_operator", "provider_manager", "booking_manager", "support_agent", "customer"]));
    for (const r of ROLES) expect(ROLE_LABELS[r], r).toBeTruthy();
    expect(LEGACY_ROLES).toEqual({ editor: "content_manager", manager: "store_manager" });
    expect(normalizeRole("editor")).toBe("content_manager");
    expect(normalizeRole("manager")).toBe("store_manager");
    expect(normalizeRole("temple_operator")).toBe("temple_operator");
    expect(normalizeRole("root")).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
    expect(isTempleScoped("temple_operator") && !isTempleScoped("temple_ops_manager")).toBe(true);
  });
  it("grants least privilege per role", () => {
    expect(PERMISSIONS.every((p) => can("superadmin", p))).toBe(true);
    expect(can("admin", "users:write")).toBe(false);
    // Store manager: catalogue + orders, not refunds, not content, not temples.
    expect(can("store_manager", "categories:write") && can("store_manager", "orders:write")).toBe(true);
    expect(can("store_manager", "orders:refund") || can("store_manager", "pages:write") || can("store_manager", "temples:read")).toBe(false);
    // Content manager: content + SEO, no commerce.
    expect(can("content_manager", "pages:publish") && can("content_manager", "seo:write")).toBe(true);
    expect(can("content_manager", "orders:read") || can("content_manager", "products:write")).toBe(false);
    // Temple roles: only the temple ops manager verifies; operators never see store orders or customers.
    expect(can("temple_ops_manager", "temples:verify")).toBe(true);
    expect(can("temple_operator", "temples:verify") || can("temple_operator", "orders:read") || can("temple_operator", "customers:read") || can("temple_operator", "users:read")).toBe(false);
    expect(can("booking_manager", "bookings:refund") && !can("booking_manager", "orders:refund")).toBe(true);
    expect(can("provider_manager", "providers:write") && !can("provider_manager", "temples:write")).toBe(true);
    // Support agent: read-only visibility.
    expect(can("support_agent", "orders:read") && can("support_agent", "bookings:read")).toBe(true);
    expect(PERMISSIONS.filter((p) => p.endsWith(":write") || p.endsWith(":refund") || p.endsWith(":publish") || p.endsWith(":verify")).some((p) => can("support_agent", p))).toBe(false);
    expect(PERMISSIONS.some((p) => can("customer", p))).toBe(false);
  });
  it("limits temple operators to their assigned temples", () => {
    const t1 = new mongoose.Types.ObjectId().toString(), t2 = new mongoose.Types.ObjectId().toString();
    const op = { role: "temple_operator" as const, templeIds: [t1] };
    const ops = { role: "temple_ops_manager" as const, templeIds: [] };
    expect(canAccessTemple(op, t1, "bookings:read")).toBe(true);
    expect(canAccessTemple(op, t2, "bookings:read")).toBe(false);
    expect(canAccessTemple(op, t1, "temples:verify")).toBe(false); // permission still required
    expect(canAccessTemple(ops, t2, "bookings:read")).toBe(true);
    expect(canAccessTemple({ role: "store_manager" }, t1, "bookings:read")).toBe(false);
    expect(() => assertTempleAccess(op, t2, "bookings:read")).toThrow(expect.objectContaining({ code: "NOT_FOUND" })); // no existence leak
    expect(() => assertTempleAccess({ role: "customer" }, t1, "bookings:read")).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(templeFilter(ops, "temple")).toEqual({});
    expect(templeFilter(op, "temple")).toEqual({ temple: { $in: [new mongoose.Types.ObjectId(t1)] } });
    expect(templeFilter({ role: "temple_operator", templeIds: [] }, "_id")).toEqual({ _id: { $in: [] } }); // nothing, not everything
  });
  it("accepts sessions issued before the rename", async () => {
    const legacy = await signSession({ uid: "a".repeat(24), role: "editor" as never, tv: 0 });
    expect(await verifySession(legacy)).toEqual({ uid: "a".repeat(24), role: "content_manager", tv: 0 });
  });
  it("validates temple assignments on users", () => {
    const id = "b".repeat(24);
    expect(createUserSchema.parse({ name: "Op", email: "op@x.com", password: "longenough1", role: "temple_operator", templeIds: [id, id] }).templeIds).toEqual([id]);
    expect(updateUserSchema.safeParse({ templeIds: ["nope"] }).success).toBe(false);
    expect(updateUserSchema.safeParse({ role: "editor" }).success).toBe(false); // new writes must use new names
  });
});

// ---------------------------------------------------------------- database
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Brass diya", slug: "brass-diya", sku: "DIYA-1", shortDescription: "", description: "", images: [{ url: "https://example.com/a.jpg", alt: "Diya" }], category: null, brand: "",
  price: 10000, salePrice: null, stock: 10, lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [],
  shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const IN = { name: "Asha Rao", line1: "12 MG Road", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "IN" };
const US = { name: "Ravi Iyer", line1: "1 Main St", city: "Edison", state: "NJ", postalCode: "08817", country: "US" };
let keyN = 0;
const place = (productId: string, over: Record<string, unknown> = {}) => placeOrder(checkoutSchema.parse({
  items: [{ productId, qty: 1 }], email: "asha@example.com", phone: "+91 98765 43210", shippingAddress: IN, billingSameAsShipping: true, paymentMethod: "cod", ...over,
}), `s12-key-${Date.now()}-${++keyN}`);

describe("Stage 12 with the database (godpuja_test)", () => {
  const wipe = () => Promise.all([Order.deleteMany({}), Product.deleteMany({}), Category.deleteMany({}), Counter.deleteMany({}), WebhookEvent.deleteMany({}), User.deleteMany({})]);
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Order.syncIndexes(), Product.syncIndexes(), WebhookEvent.syncIndexes(), User.syncIndexes()]);
  });
  beforeEach(wipe);
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });

  let n = 0;
  const mk = (over: Partial<ProductInput> = {}) => { n++; return createProduct(prod({ name: `S12 ${n}`, slug: `s12-${n}`, sku: `S12-${n}`, ...over })); };
  const stockOf = async (id: string) => (await Product.findById(id).lean())!.stock;
  /** Simulates an online-gateway order: placed, then moved to pending_payment as a gateway provider would create it. */
  const pendingOrder = async (productId: string) => {
    const r = await place(productId);
    await Order.updateOne({ _id: r.orderId }, { $set: { status: "pending_payment" } });
    return r;
  };

  it("records the currency on every order and shows it to the customer", async () => {
    const p = await mk();
    const r = await place(p.id);
    expect(r).toMatchObject({ status: "confirmed", currency: "INR" });
    expect((await Order.findById(r.orderId).lean())!.currency).toBe("INR");
    expect((await getCustomerOrder(r.orderId, r.accessToken)).currency).toBe("INR");
    expect((await listOrders(listOrdersSchema.parse({}))).items[0].currency).toBe("INR");
  });

  it("only delivers to SHIPPING_COUNTRIES, but bills anywhere", async () => {
    const p = await mk({ stock: 5 });
    const err = await fails(place(p.id, { shippingAddress: US }), "VALIDATION_ERROR");
    expect(err.fields).toEqual({ "shippingAddress.country": "We do not deliver to United States yet" });
    expect(await stockOf(p.id)).toBe(5); // rejected before any stock is taken
    expect(() => assertShippable("IN")).not.toThrow();
    const r = await place(p.id, { billingSameAsShipping: false, billingAddress: US });
    const o = await getAdminOrder(r.orderId);
    expect(o.billingAddress).toEqual(US);
    expect(o.shippingAddress).toEqual(IN);
  });

  it("reads orders stored before Stage 12 (pincode, no currency)", async () => {
    const p = await mk();
    const r = await place(p.id);
    await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(r.orderId) }, {
      $unset: { currency: "" }, $rename: { "shippingAddress.postalCode": "shippingAddress.pincode", "billingAddress.postalCode": "billingAddress.pincode" },
    });
    const o = await getAdminOrder(r.orderId);
    expect(o.currency).toBe("INR");
    expect(o.shippingAddress.postalCode).toBe("411001");
    expect((await getCustomerOrder(r.orderId, r.accessToken)).billingAddress.postalCode).toBe("411001");
    let csv = "";
    for await (const c of exportOrderRows(listOrdersSchema.parse({}))) csv += c;
    expect(csv.split("\r\n")[1]).toContain(",411001,IN,");
    expect(csv.split("\r\n")[1]).toContain(",INR,100.00,");
  });

  it("a gateway order waiting for payment is confirmed only when paid (admin)", async () => {
    const p = await mk();
    const r = await pendingOrder(p.id);
    expect((await getAdminOrder(r.orderId)).allowedNext).toEqual(["cancelled"]);
    const failed = await changePayment(r.orderId, "failed", ACTOR);
    expect(failed).toMatchObject({ status: "payment_failed", payment: { status: "failed" } });
    const paid = await changePayment(r.orderId, "paid", ACTOR);
    expect(paid).toMatchObject({ status: "confirmed", payment: { status: "paid" } });
    expect(paid.history.slice(-2).map((h) => [h.kind, h.status])).toEqual([["payment", "payment_failed"], ["status", "confirmed"]]);
  });

  it("cancelling an unpaid order returns its stock", async () => {
    const p = await mk({ stock: 3 });
    const r = await pendingOrder(p.id);
    expect(await stockOf(p.id)).toBe(2);
    await changePayment(r.orderId, "failed", ACTOR);
    await changeStatus(r.orderId, "cancelled", "Customer abandoned payment", ACTOR);
    expect(await stockOf(p.id)).toBe(3);
    await fails(changePayment(r.orderId, "paid", ACTOR), "CONFLICT");
  });

  it("the payment webhook confirms a pending order and rejects a currency mismatch", async () => {
    const p = await mk();
    const r = await pendingOrder(p.id);
    const ev = (over: Record<string, unknown>) => webhookEventSchema.parse({ eventId: `evt-${Math.random()}`, type: "payment.succeeded", timestamp: Date.now(), orderNumber: r.orderNumber, ...over });
    await fails(applyPaymentEvent(ev({ currency: "USD" })), "VALIDATION_ERROR");
    expect((await getAdminOrder(r.orderId)).status).toBe("pending_payment");
    await applyPaymentEvent(ev({ currency: "INR", amount: 15000 }));
    const o = await getAdminOrder(r.orderId);
    expect(o).toMatchObject({ status: "confirmed", payment: { status: "paid" } });
    expect(o.history.at(-1)).toMatchObject({ kind: "status", status: "confirmed", by: { name: "Payment webhook" } });
  });

  it("a failed webhook payment marks the order payment_failed; it never looks confirmed", async () => {
    const p = await mk();
    const r = await pendingOrder(p.id);
    await applyPaymentEvent(webhookEventSchema.parse({ eventId: "evt-f", type: "payment.failed", timestamp: Date.now(), orderNumber: r.orderNumber }));
    expect(await getAdminOrder(r.orderId)).toMatchObject({ status: "payment_failed", payment: { status: "failed" } });
  });

  it("a cancelled or returned order refunded in full becomes refunded; partial refunds do not", async () => {
    const p = await mk({ stock: 5 });
    const a = await place(p.id);
    await changePayment(a.orderId, "paid", ACTOR);
    await changeStatus(a.orderId, "cancelled", undefined, ACTOR);
    const part = await refundOrder(a.orderId, 5000, "Part", ACTOR);
    expect(part).toMatchObject({ status: "cancelled", payment: { status: "partially_refunded" } });
    const full = await refundOrder(a.orderId, undefined, "Rest", ACTOR);
    expect(full).toMatchObject({ status: "refunded", payment: { status: "refunded" }, allowedNext: [] });
    expect(full.history.find((h) => h.kind === "refund")?.note).toContain("₹50");

    // Delivered (not returned) and refunded in full stays delivered: the goods were kept.
    const b = await place(p.id);
    await changePayment(b.orderId, "paid", ACTOR);
    for (const s of ["processing", "shipped", "delivered"] as const) await changeStatus(b.orderId, s, undefined, ACTOR);
    expect((await refundOrder(b.orderId, undefined, "Goodwill", ACTOR)).status).toBe("delivered");
  });

  it("supports return requests that are accepted or declined", async () => {
    const p = await mk({ stock: 5 });
    const ship = async () => { const r = await place(p.id); for (const s of ["processing", "shipped", "delivered"] as const) await changeStatus(r.orderId, s, undefined, ACTOR); return r; };
    const a = await ship();
    await changeStatus(a.orderId, "return_requested", "Damaged in transit", ACTOR);
    expect((await changeStatus(a.orderId, "returned", undefined, ACTOR)).status).toBe("returned");
    const b = await ship();
    await changeStatus(b.orderId, "return_requested", undefined, ACTOR);
    expect((await changeStatus(b.orderId, "delivered", "Outside return window", ACTOR)).status).toBe("delivered");
    await fails(changeStatus(b.orderId, "cancelled", undefined, ACTOR), "CONFLICT");
  });

  it("filters admin date ranges by ADMIN_TIMEZONE days", async () => {
    const p = await mk();
    const r = await place(p.id);
    // 19:00 UTC on 2 Nov is 00:30 on 3 Nov in India.
    await Order.updateOne({ _id: r.orderId }, { $set: { createdAt: new Date("2026-11-02T19:00:00Z") } }, { timestamps: false });
    expect((await listOrders(listOrdersSchema.parse({ from: "2026-11-03", to: "2026-11-03" }))).total).toBe(1);
    expect((await listOrders(listOrdersSchema.parse({ from: "2026-11-02", to: "2026-11-02" }))).total).toBe(0);
  });

  it("stores temple assignments and keeps legacy role rows working", async () => {
    const t = new mongoose.Types.ObjectId().toString();
    const op = await createUser({ name: "Temple Op", email: "op@x.com", password: "longenough1", role: "temple_operator", templeIds: [t] });
    expect(op).toMatchObject({ role: "temple_operator", templeIds: [t] });
    const admin = await createUser({ name: "Root", email: "root@x.com", password: "longenough1", role: "superadmin" });
    expect((await updateUser(admin.id, op.id, { templeIds: [] })).templeIds).toEqual([]);

    // A row written before the rename (raw insert bypasses the schema enum check on purpose).
    const legacy = await User.collection.insertOne({ name: "Old Editor", email: "old@x.com", passwordHash: "x", role: "editor", isActive: true, tokenVersion: 0, templeIds: [], createdAt: new Date() });
    const resolved = await resolveUser({ uid: String(legacy.insertedId), role: "content_manager", tv: 0 });
    expect(resolved?.role).toBe("content_manager");
    const listed = await listUsers({ role: "content_manager", page: 1, limit: 20 });
    expect(listed.items.map((u) => [u.email, u.role])).toEqual([["old@x.com", "content_manager"]]);
    // Changing a legacy row to its own new name is not a role change (no session revocation).
    await updateUser(admin.id, String(legacy.insertedId), { role: "content_manager" });
    expect((await User.findById(legacy.insertedId).lean())!.tokenVersion).toBe(0);
  });
});
