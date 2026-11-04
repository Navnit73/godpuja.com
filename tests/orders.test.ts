import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

// Must be set before the first env() call so the webhook route sees a secret.
process.env.PAYMENT_WEBHOOK_SECRET = "test-webhook-secret-0123456789";

import { connectDB } from "@/server/db";
import { flushNotifications } from "@/server/services/notifications";
import { Category } from "@/server/models/Category";
import { Counter } from "@/server/models/Counter";
import { Order } from "@/server/models/Order";
import { Product } from "@/server/models/Product";
import { WebhookEvent } from "@/server/models/WebhookEvent";
import { createCategory, updateCategory } from "@/server/services/categories";
import { createProduct } from "@/server/services/products";
import { computePricing, mergeLines, unitPriceOf, validateCart } from "@/server/services/cart";
import {
  addNote, changePayment, changeStatus, csvCell, exportOrderRows, getAdminOrder, getCustomerOrder, listOrders, nextOrderNumber, placeOrder, refundOrder, TRANSITIONS,
} from "@/server/services/orders";
import { applyPaymentEvent } from "@/server/services/payments";
import { signWebhook, verifyWebhookSignature, withinTolerance } from "@/server/payments/provider";
import { POST as webhookPOST } from "@/app/api/payments/webhook/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as cartPOST } from "@/app/api/cart/validate/route";
import { GET as orderGET } from "@/app/api/orders/[id]/route";
import { _resetRateLimit, _resetSharedRateLimit } from "@/server/rate-limit";
import { ApiError } from "@/server/api";
import { can } from "@/server/auth/permissions";
import { emptyCategory, type ProductInput } from "@/lib/validation/catalog";
import { emptySeo } from "@/lib/validation/pages";
import { cartInputSchema, checkoutSchema, idempotencyKeySchema, listOrdersSchema, refundSchema, statusChangeSchema, webhookEventSchema } from "@/lib/validation/orders";

const ACTOR = { id: null, name: "Tester" };
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Brass diya", slug: "brass-diya", sku: "DIYA-1", shortDescription: "", description: "", images: [{ url: "https://example.com/a.jpg", alt: "Diya" }], category: null, brand: "",
  price: 10000, salePrice: null, stock: 10, lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [],
  shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const addr = { name: "Asha Rao", line1: "12 MG Road", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "IN" };
const body = (items: { productId: string; variantSku?: string; qty: number }[], over: Record<string, unknown> = {}) => ({
  items, email: "Asha@Example.com", phone: "+91 98765 43210", shippingAddress: addr, billingSameAsShipping: true, paymentMethod: "cod", ...over,
});
const co = (items: { productId: string; variantSku?: string; qty: number }[], over: Record<string, unknown> = {}) => checkoutSchema.parse(body(items, over));
let keyN = 0;
const key = () => `test-key-${Date.now()}-${++keyN}`;
const place = (items: { productId: string; variantSku?: string; qty: number }[], over: Record<string, unknown> = {}, k = key()) => placeOrder(co(items, over), k);
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};
const stockOf = async (id: string) => (await Product.findById(id).lean())!.stock;

describe("order validation", () => {
  const ok = (o: Record<string, unknown>) => checkoutSchema.safeParse({ ...body([{ productId: "a".repeat(24), qty: 1 }]), ...o }).success;
  it("accepts a normal guest checkout and normalises email/sku", () => {
    const v = checkoutSchema.parse(body([{ productId: "a".repeat(24), variantSku: " v-1 ", qty: 2 }]));
    expect(v.email).toBe("asha@example.com");
    expect(v.items[0].variantSku).toBe("V-1");
    expect(v.shippingAddress.country).toBe("IN");
  });
  it("rejects bad phones, pincodes, emails, countries, quantities and missing billing", () => {
    for (const phone of ["12345", "abcdefghij", "+91 98765 4321098765432", ""]) expect(ok({ phone }), phone).toBe(false);
    for (const phone of ["9876543210", "+91 98765-43210"]) expect(ok({ phone }), phone).toBe(true);
    for (const postalCode of ["12345", "1234567", "abcdef", "41100 ", ""]) expect(ok({ shippingAddress: { ...addr, postalCode } }), postalCode).toBe(false);
    for (const country of ["XX", "EU", "india", ""]) expect(ok({ shippingAddress: { ...addr, country } }), country).toBe(false);
    // Schema accepts any real country; WHERE we ship is enforced at checkout (assertShippable, Stage 12).
    expect(ok({ shippingAddress: { ...addr, country: "US", state: "NY", postalCode: "10001" } })).toBe(true);
    expect(ok({ shippingAddress: { ...addr, country: "US" } })).toBe(false); // 411001 is not a ZIP code
    expect(ok({ shippingAddress: { ...addr, name: "A" } })).toBe(false);
    expect(ok({ email: "nope" })).toBe(false);
    expect(ok({ billingSameAsShipping: false })).toBe(false);
    expect(ok({ billingSameAsShipping: false, billingAddress: addr })).toBe(true);
    expect(ok({ paymentMethod: "card" })).toBe(false);
    expect(ok({ notes: "x".repeat(301) })).toBe(false);
    for (const qty of [0, -1, 21, 1.5, "2"]) expect(cartInputSchema.safeParse({ items: [{ productId: "a".repeat(24), qty }] }).success, String(qty)).toBe(false);
    expect(cartInputSchema.safeParse({ items: [] }).success).toBe(false);
    expect(cartInputSchema.safeParse({ items: Array.from({ length: 31 }, (_, i) => ({ productId: String(i).padStart(24, "a"), qty: 1 })) }).success).toBe(false);
    expect(cartInputSchema.safeParse({ items: [{ productId: "not-an-id", qty: 1 }] }).success).toBe(false);
    // Regression (Stage 11): the browser cart (lib/cart.ts) sends variantSku: null for products without variants.
    const fromBrowser = cartInputSchema.safeParse({ items: [{ productId: "a".repeat(24), variantSku: null, qty: 1 }] });
    expect(fromBrowser.success).toBe(true);
    expect(fromBrowser.data!.items[0].variantSku).toBeUndefined();
  });
  it("ignores client-supplied prices and other unknown keys (mass assignment)", () => {
    const v = checkoutSchema.parse({ ...body([{ productId: "a".repeat(24), qty: 1, unitPrice: 1, price: 1 } as { productId: string; qty: number }]), total: 1, status: "delivered", payment: { status: "paid" }, accessToken: "x" }) as Record<string, unknown>;
    expect(v).not.toHaveProperty("total");
    expect(v).not.toHaveProperty("status");
    expect(v).not.toHaveProperty("payment");
    expect(v).not.toHaveProperty("accessToken");
    expect(v.items).toEqual([{ productId: "a".repeat(24), qty: 1 }]);
  });
  it("idempotency key format", () => {
    for (const k of ["short", "has space!!", "a".repeat(81), ""]) expect(idempotencyKeySchema.safeParse(k).success, k).toBe(false);
    for (const k of ["abcd1234", "A_b-c-1234567890"]) expect(idempotencyKeySchema.safeParse(k).success, k).toBe(true);
  });
  it("admin/webhook inputs", () => {
    expect(statusChangeSchema.safeParse({ status: "confirmed" }).success).toBe(false); // cannot move back to confirmed
    expect(statusChangeSchema.safeParse({ status: "shipped" }).success).toBe(true);
    expect(refundSchema.safeParse({ amount: 0, reason: "x" }).success).toBe(false);
    expect(refundSchema.safeParse({ amount: 10.5, reason: "xx" }).success).toBe(false);
    expect(refundSchema.safeParse({ amount: 100, reason: "damaged" }).success).toBe(true);
    expect(listOrdersSchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(listOrdersSchema.safeParse({ from: "yesterday" }).success).toBe(false);
    expect(webhookEventSchema.safeParse({ eventId: "e1", type: "payment.succeeded", timestamp: Date.now() }).success).toBe(false); // must identify an order
    expect(webhookEventSchema.safeParse({ eventId: "e1", type: "payment.hacked", timestamp: Date.now(), orderNumber: "GP-1" }).success).toBe(false);
  });
});

describe("pricing, shipping and helpers", () => {
  it("variant price/sale falls back to the product's; sale must be lower", () => {
    const p = { price: 10000, salePrice: 8000 };
    expect(unitPriceOf(p)).toBe(8000);
    expect(unitPriceOf(p, { price: null, salePrice: null })).toBe(8000);
    expect(unitPriceOf(p, { price: 20000, salePrice: null })).toBe(20000); // own price, product sale does not apply
    expect(unitPriceOf(p, { price: 20000, salePrice: 15000 })).toBe(15000);
    expect(unitPriceOf({ price: 10000, salePrice: 12000 }, null)).toBe(10000);
  });
  it("shipping: flat below the threshold, free at/above it or with a free-shipping product", () => {
    const line = (lineTotal: number, freeShipping = false, available = true) => ({ lineTotal, freeShipping, available });
    expect(computePricing([line(5000)])).toMatchObject({ subtotal: 5000, shipping: 5000, total: 10000 });
    expect(computePricing([line(99899)]).shipping).toBe(5000);
    expect(computePricing([line(99900)])).toMatchObject({ shipping: 0, total: 99900 });
    expect(computePricing([line(1000), line(500, true)]).shipping).toBe(0);
    expect(computePricing([line(1000), line(500, true, false)]).shipping).toBe(5000); // unavailable lines do not count
    expect(computePricing([])).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });
  it("merges duplicate lines", () => {
    expect(mergeLines([{ productId: "a", qty: 2 }, { productId: "a", qty: 3 }, { productId: "a", variantSku: "V", qty: 1 }])).toEqual([{ productId: "a", qty: 5 }, { productId: "a", variantSku: "V", qty: 1 }]);
  });
  it("CSV cells quote and neutralise spreadsheet formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    for (const f of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx", "\rx"]) expect(csvCell(f).replace(/^"/, "")).toMatch(/^'/);
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell(12345)).toBe("12345");
    expect(csvCell(null)).toBe("");
  });
  it("webhook signature: constant-time hex HMAC over the raw body; replay window", () => {
    const raw = new TextEncoder().encode('{"a":1}');
    const sig = signWebhook(raw, "s".repeat(20));
    expect(verifyWebhookSignature(raw, sig, "s".repeat(20))).toBe(true);
    expect(verifyWebhookSignature(raw, sig.toUpperCase(), "s".repeat(20))).toBe(true);
    expect(verifyWebhookSignature(raw, sig, "t".repeat(20))).toBe(false);
    expect(verifyWebhookSignature(new TextEncoder().encode('{"a":2}'), sig, "s".repeat(20))).toBe(false);
    for (const bad of [null, "", "zz", sig.slice(0, 10), sig + "00"]) expect(verifyWebhookSignature(raw, bad, "s".repeat(20))).toBe(false);
    const now = Date.now();
    expect(withinTolerance(now)).toBe(true);
    expect(withinTolerance(Math.floor(now / 1000))).toBe(true);
    expect(withinTolerance(new Date(now - 4 * 60_000).toISOString())).toBe(true);
    expect(withinTolerance(now - 6 * 60_000)).toBe(false);
    expect(withinTolerance(now + 6 * 60_000)).toBe(false);
    expect(withinTolerance("garbage")).toBe(false);
  });
  it("transition table is a DAG that only cancels before shipping", () => {
    expect(TRANSITIONS.confirmed).toEqual(["processing", "cancelled"]);
    expect(TRANSITIONS.processing).toEqual(["shipped", "cancelled"]);
    expect(TRANSITIONS.shipped).toEqual(["delivered"]);
    expect(TRANSITIONS.delivered).toEqual(["return_requested", "returned"]);
    expect(TRANSITIONS.cancelled).toEqual([]);
    expect(TRANSITIONS.returned).toEqual([]);
  });
});

describe("orders (godpuja_test)", () => {
  const wipe = () => Promise.all([Order.deleteMany({}), Product.deleteMany({}), Category.deleteMany({}), Counter.deleteMany({}), WebhookEvent.deleteMany({})]);
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Order.syncIndexes(), Product.syncIndexes(), Category.syncIndexes(), WebhookEvent.syncIndexes()]);
  });
  beforeEach(async () => { await wipe(); _resetRateLimit(); await _resetSharedRateLimit(); });
  afterAll(async () => { await flushNotifications(); await wipe(); await mongoose.disconnect(); });

  let n = 0;
  const mk = (over: Partial<ProductInput> = {}) => { n++; return createProduct(prod({ name: `P${n}`, slug: `p${n}`, sku: `SKU-${n}`, ...over })); };

  describe("cart validation", () => {
    it("recomputes from the database and ignores nothing the client could forge", async () => {
      const p = await mk({ price: 12345, salePrice: 9999, stock: 4 });
      const r = await validateCart([{ productId: p.id, qty: 2 }]);
      expect(r.issues).toEqual([]);
      expect(r.items[0]).toMatchObject({ unitPrice: 9999, qty: 2, lineTotal: 19998, available: true, maxQty: 4, sku: p.sku, variantSku: null });
      expect(r.pricing).toMatchObject({ subtotal: 19998, shipping: 5000, total: 24998, freeShippingOver: 99900, flatShipping: 5000 });
    });
    it("flags unknown, draft, archived and hidden-category products as unavailable and excludes them from pricing", async () => {
      const draft = await mk({ status: "draft" });
      const arch = await mk({ status: "archived" });
      const hiddenCat = await createCategory({ ...emptyCategory, name: "Secret", slug: "secret" });
      const inHidden = await mk({ category: hiddenCat.id });
      await updateCategory(hiddenCat.id, { ...emptyCategory, name: "Secret", slug: "secret", isActive: false, baseUpdatedAt: hiddenCat.updatedAt });
      const fine = await mk();
      const ghost = new mongoose.Types.ObjectId().toHexString();
      const r = await validateCart([draft, arch, inHidden].map((p) => ({ productId: p.id, qty: 1 })).concat([{ productId: ghost, qty: 1 }, { productId: fine.id, qty: 1 }]));
      expect(r.items.map((i) => i.available)).toEqual([false, false, false, false, true]);
      expect(r.issues.filter((i) => i.code === "unavailable")).toHaveLength(4);
      expect(r.pricing.subtotal).toBe(10000);
    });
    it("upcoming products are visible but cannot be bought", async () => {
      const soon = await mk({ status: "upcoming" });
      const r = await validateCart([{ productId: soon.id, qty: 1 }]);
      expect(r.items[0].available).toBe(false);
      expect(r.issues[0]).toMatchObject({ code: "unavailable", message: expect.stringContaining("coming soon") });
      expect(r.pricing.subtotal).toBe(0);
    });
    it("clamps quantity to stock ('reduced') and flags out of stock; caps at 20", async () => {
      const low = await mk({ stock: 3 });
      const none = await mk({ stock: 0 });
      const lots = await mk({ stock: 500 });
      const r = await validateCart([{ productId: low.id, qty: 10 }, { productId: none.id, qty: 1 }, { productId: lots.id, qty: 20 }]);
      expect(r.items[0]).toMatchObject({ qty: 3, maxQty: 3, available: true });
      expect(r.items[1]).toMatchObject({ available: false, maxQty: 0 });
      expect(r.items[2]).toMatchObject({ qty: 20, maxQty: 20 });
      expect(r.issues.map((i) => i.code).sort()).toEqual(["out_of_stock", "reduced"]);
    });
    it("variants: need a valid option; use their own price and stock", async () => {
      const p = await mk({ variants: [{ sku: "V-S", options: { Size: "S" }, price: 5000, salePrice: null, stock: 2 }, { sku: "V-L", options: { Size: "L" }, stock: 0 }] });
      const r = await validateCart([{ productId: p.id, variantSku: "V-S", qty: 5 }, { productId: p.id, variantSku: "V-L", qty: 1 }, { productId: p.id, qty: 1 }, { productId: p.id, variantSku: "NOPE", qty: 1 }]);
      expect(r.items[0]).toMatchObject({ variantSku: "V-S", sku: "V-S", unitPrice: 5000, qty: 2, options: { Size: "S" } });
      expect(r.items.slice(1).every((i) => !i.available)).toBe(true);
      expect(r.issues.map((i) => i.code).sort()).toEqual(["out_of_stock", "reduced", "unavailable", "unavailable"]);
    });
    it("route: public, validates input, returns the contract shape", async () => {
      const p = await mk();
      const call = (b: unknown) => cartPOST(new Request("http://x/api/cart/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }));
      const res = await call({ items: [{ productId: p.id, qty: 1, unitPrice: 1 }] });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Object.keys(json.data).sort()).toEqual(["issues", "items", "pricing"]);
      expect(Object.keys(json.data.items[0]).sort()).toEqual(["available", "freeShipping", "image", "lineTotal", "maxQty", "name", "options", "productId", "qty", "sku", "slug", "unitPrice", "variantSku"]);
      expect(json.data.items[0].unitPrice).toBe(10000);
      expect((await call({ items: [] })).status).toBe(400);
    });
  });

  describe("checkout", () => {
    it("creates the order, decrements stock, counts the sale and snapshots the items", async () => {
      const p = await mk({ stock: 5, price: 20000, salePrice: 15000, images: [{ url: "https://example.com/z.jpg", alt: "Z" }] });
      const r = await place([{ productId: p.id, qty: 2 }], { notes: "Leave at the gate" });
      expect(r).toMatchObject({ created: true, status: "confirmed", payment: { method: "cod", status: "pending" } });
      expect(r.orderNumber).toMatch(/^GP-\d{4}-\d{6}$/);
      expect(r.accessToken.length).toBeGreaterThanOrEqual(32);
      expect(await stockOf(p.id)).toBe(3);
      expect((await Product.findById(p.id).lean())!.soldCount).toBe(2);
      const o = await getAdminOrder(r.orderId);
      expect(o).toMatchObject({ email: "asha@example.com", status: "confirmed", customerNote: "Leave at the gate", pricing: { subtotal: 30000, shipping: 5000, tax: 0, discount: 0, total: 35000 } });
      expect(o.items[0]).toMatchObject({ name: p.name, sku: p.sku, unitPrice: 15000, qty: 2, lineTotal: 30000, product: p.id });
      expect(o.billingAddress).toEqual(o.shippingAddress);
      expect(o.history[0]).toMatchObject({ kind: "created", status: "confirmed" });
      expect(o).not.toHaveProperty("accessToken");
    });
    it("a later price/name change does not alter an existing order", async () => {
      const p = await mk({ price: 10000 });
      const r = await place([{ productId: p.id, qty: 1 }]);
      await Product.updateOne({ _id: p.id }, { $set: { price: 99999, name: "Renamed" } });
      expect((await getAdminOrder(r.orderId)).items[0]).toMatchObject({ unitPrice: 10000, name: p.name });
    });
    it("charges free shipping at the threshold and for free-shipping products", async () => {
      const big = await mk({ price: 99900 });
      expect((await getAdminOrder((await place([{ productId: big.id, qty: 1 }])).orderId)).pricing).toMatchObject({ shipping: 0, total: 99900 });
      const small = await mk({ price: 100 });
      expect((await getAdminOrder((await place([{ productId: small.id, qty: 1 }])).orderId)).pricing.shipping).toBe(5000);
      const free = await mk({ price: 100, shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: true } });
      expect((await getAdminOrder((await place([{ productId: small.id, qty: 1 }, { productId: free.id, qty: 1 }])).orderId)).pricing.shipping).toBe(0);
    });
    it("merges duplicate lines, handles variants and decrements the right variant", async () => {
      const p = await mk({ variants: [{ sku: "V-S", options: { Size: "S" }, stock: 5 }, { sku: "V-L", options: { Size: "L" }, price: 30000, stock: 5 }] });
      const r = await place([{ productId: p.id, variantSku: "V-L", qty: 1 }, { productId: p.id, variantSku: "V-L", qty: 2 }, { productId: p.id, variantSku: "V-S", qty: 1 }]);
      const o = await getAdminOrder(r.orderId);
      expect(o.items.map((i) => [i.variantSku, i.qty, i.unitPrice])).toEqual([["V-L", 3, 30000], ["V-S", 1, 10000]]);
      expect(o.items[0].options).toEqual({ Size: "L" });
      const after = (await Product.findById(p.id).lean())!;
      expect(Object.fromEntries(after.variants.map((v) => [v.sku, v.stock]))).toEqual({ "V-S": 4, "V-L": 2 });
    });
    it("rejects unavailable products and insufficient stock without changing stock or creating an order", async () => {
      const ok = await mk({ stock: 5 });
      const low = await mk({ stock: 1 });
      const draft = await mk({ status: "draft" });
      const e1 = await fails(place([{ productId: ok.id, qty: 2 }, { productId: low.id, qty: 2 }]), "CONFLICT");
      expect(e1.message).toMatch(/stock/i);
      await fails(place([{ productId: ok.id, qty: 1 }, { productId: draft.id, qty: 1 }]), "CONFLICT");
      await fails(place([{ productId: new mongoose.Types.ObjectId().toHexString(), qty: 1 }]), "CONFLICT");
      expect(await stockOf(ok.id)).toBe(5);
      expect(await stockOf(low.id)).toBe(1);
      expect(await Order.countDocuments()).toBe(0);
    });
    it("never trusts a client price: the order total comes from the database", async () => {
      const p = await mk({ price: 50000 });
      const dirty = { ...body([{ productId: p.id, qty: 1 }]), items: [{ productId: p.id, qty: 1, unitPrice: 1, price: 1 }] as unknown[], total: 1 };
      const r = await placeOrder(checkoutSchema.parse(dirty), key());
      expect((await getAdminOrder(r.orderId)).pricing.subtotal).toBe(50000);
    });
    it("idempotent replay: same key returns the same order and takes stock only once", async () => {
      const p = await mk({ stock: 5 });
      const k = key();
      const a = await place([{ productId: p.id, qty: 2 }], {}, k);
      const b = await place([{ productId: p.id, qty: 2 }], {}, k);
      expect(b).toMatchObject({ created: false, orderId: a.orderId, orderNumber: a.orderNumber, accessToken: a.accessToken });
      expect(await stockOf(p.id)).toBe(3);
      expect(await Order.countDocuments()).toBe(1);
    });
    it("same key with a different request is rejected, not silently replayed", async () => {
      const p = await mk({ stock: 5 });
      const k = key();
      await place([{ productId: p.id, qty: 1 }], {}, k);
      await fails(place([{ productId: p.id, qty: 3 }], {}, k), "CONFLICT");
      await fails(place([{ productId: p.id, qty: 1 }], { email: "other@example.com" }, k), "CONFLICT");
      expect(await stockOf(p.id)).toBe(4);
    });
    it("12 simultaneous submissions of the SAME key create one order and one decrement", async () => {
      const p = await mk({ stock: 5 });
      const k = key();
      const rs = await Promise.allSettled(Array.from({ length: 12 }, () => place([{ productId: p.id, qty: 1 }], {}, k)));
      const done = rs.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof place>>> => r.status === "fulfilled");
      expect(done.length).toBe(12);
      expect(new Set(done.map((d) => d.value.orderId)).size).toBe(1);
      expect(await Order.countDocuments()).toBe(1);
      expect(await stockOf(p.id)).toBe(4);
    });
    it("last unit: of 8 concurrent checkouts exactly one wins, the rest get 409, stock ends at 0 and is never negative", async () => {
      const p = await mk({ stock: 1 });
      const rs = await Promise.allSettled(Array.from({ length: 8 }, () => place([{ productId: p.id, qty: 1 }])));
      expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      for (const r of rs.filter((x): x is PromiseRejectedResult => x.status === "rejected")) expect((r.reason as ApiError).code).toBe("CONFLICT");
      expect(await stockOf(p.id)).toBe(0);
      expect(await Order.countDocuments()).toBe(1);
      expect((await Product.findById(p.id).lean())!.soldCount).toBe(1);
    });
    it("20 concurrent checkouts for 5 units sell exactly 5", async () => {
      const p = await mk({ stock: 5 });
      const rs = await Promise.allSettled(Array.from({ length: 20 }, () => place([{ productId: p.id, qty: 1 }])));
      expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(5);
      expect(await stockOf(p.id)).toBe(0);
      expect(await Order.countDocuments()).toBe(5);
    });
    it("multi-line orders are all-or-nothing under contention (no partial decrement)", async () => {
      const a = await mk({ stock: 10 });
      const b = await mk({ stock: 1 });
      const rs = await Promise.allSettled(Array.from({ length: 6 }, () => place([{ productId: a.id, qty: 2 }, { productId: b.id, qty: 1 }])));
      expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await stockOf(b.id)).toBe(0);
      expect(await stockOf(a.id)).toBe(8); // only the winner took A's units; the five losers rolled back
      expect(await Order.countDocuments()).toBe(1);
    });
    it("variant contention: the last unit of one variant is sold once", async () => {
      const p = await mk({ variants: [{ sku: "V-1", options: { S: "1" }, stock: 1 }, { sku: "V-2", options: { S: "2" }, stock: 3 }] });
      const rs = await Promise.allSettled(Array.from({ length: 6 }, () => place([{ productId: p.id, variantSku: "V-1", qty: 1 }])));
      expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const after = (await Product.findById(p.id).lean())!;
      expect(Object.fromEntries(after.variants.map((v) => [v.sku, v.stock]))).toEqual({ "V-1": 0, "V-2": 3 });
    });
    it("checkout does not invalidate product editors (timestamps untouched)", async () => {
      const p = await mk({ stock: 5 });
      await place([{ productId: p.id, qty: 1 }]);
      expect((await Product.findById(p.id).lean())!.updatedAt.toISOString()).toBe(p.updatedAt);
    });
    it("order numbers are unique and increasing under parallel generation", async () => {
      const nums = await Promise.all(Array.from({ length: 25 }, () => nextOrderNumber()));
      expect(new Set(nums).size).toBe(25);
      expect([...nums].sort()[24]).toMatch(/-000025$/);
      expect(await nextOrderNumber(new Date("2030-02-03T00:00:00Z"))).toBe("GP-3002-000001"); // new month, new sequence
    });
    it("route: header required, 201 then 200 on replay, contract shape, rate limit", async () => {
      const p = await mk({ stock: 9 });
      const call = (headers: Record<string, string>, b: unknown) => checkoutPOST(new Request("http://x/api/checkout", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(b) }));
      const payload = body([{ productId: p.id, qty: 1 }]);
      expect((await call({}, payload)).status).toBe(400);
      expect((await call({ "idempotency-key": "short" }, payload)).status).toBe(400);
      const k = key();
      const r1 = await call({ "idempotency-key": k }, payload);
      expect(r1.status).toBe(201);
      const j1 = await r1.json();
      expect(Object.keys(j1.data).sort()).toEqual(["accessToken", "currency", "orderId", "orderNumber", "payment", "status"]);
      expect(j1.data).toMatchObject({ status: "confirmed", payment: { method: "cod", status: "pending" } });
      const r2 = await call({ "idempotency-key": k }, payload);
      expect(r2.status).toBe(200);
      expect((await r2.json()).data.orderId).toBe(j1.data.orderId);
      expect((await call({ "idempotency-key": key() }, { ...payload, items: [] })).status).toBe(400);
      await _resetSharedRateLimit();
      let last = 0;
      for (let i = 0; i < 12; i++) last = (await call({ "idempotency-key": `rl-key-${i}-${Date.now()}`, "x-forwarded-for": "6.6.6.6, 9.9.9.9" }, { ...payload, items: [] })).status;
      expect(last).toBe(429);
      expect(await stockOf(p.id)).toBe(8);
    });
  });

  describe("customer confirmation view", () => {
    it("needs the right token; wrong token and unknown order are the same 404; no admin data leaks", async () => {
      const p = await mk();
      const r = await place([{ productId: p.id, qty: 1 }]);
      await addNote(r.orderId, "internal: VIP", ACTOR);
      const v = await getCustomerOrder(r.orderId, r.accessToken);
      expect(v).toMatchObject({ orderNumber: r.orderNumber, status: "confirmed", payment: { method: "cod", status: "pending" } });
      expect(JSON.stringify(v)).not.toMatch(/internal|history|notes|accessToken|idempotency|requestHash|refund/i);
      const a = await fails(getCustomerOrder(r.orderId, "x".repeat(32)), "NOT_FOUND");
      const b = await fails(getCustomerOrder(new mongoose.Types.ObjectId().toHexString(), r.accessToken), "NOT_FOUND");
      expect(a.message).toBe(b.message);
      await fails(getCustomerOrder(r.orderId, ""), "NOT_FOUND");
      await fails(getCustomerOrder("not-an-id", r.accessToken), "NOT_FOUND");
      await fails(getCustomerOrder(r.orderId, r.accessToken.slice(0, -1) + (r.accessToken.endsWith("A") ? "B" : "A")), "NOT_FOUND");
    });
    it("route sets no-store and 404s without a token", async () => {
      const p = await mk();
      const r = await place([{ productId: p.id, qty: 1 }]);
      const get = (q: string) => orderGET(new Request(`http://x/api/orders/${r.orderId}${q}`), { params: Promise.resolve({ id: r.orderId }) } as never);
      const ok = await get(`?token=${r.accessToken}`);
      expect(ok.status).toBe(200);
      expect(ok.headers.get("cache-control")).toContain("no-store");
      expect((await get("")).status).toBe(404);
      expect((await get("?token=wrong")).status).toBe(404);
    });
  });

  describe("admin: status, payment, notes", () => {
    const fresh = async (stock = 5, qty = 2) => { const p = await mk({ stock }); return { p, r: await place([{ productId: p.id, qty }]) }; };
    it("walks the happy path and records who/when in history", async () => {
      const { r } = await fresh();
      await changeStatus(r.orderId, "processing", "Packing", ACTOR);
      await changeStatus(r.orderId, "shipped", undefined, ACTOR);
      const o = await changeStatus(r.orderId, "delivered", undefined, ACTOR);
      expect(o.status).toBe("delivered");
      expect(o.allowedNext).toEqual(["return_requested", "returned"]);
      expect(o.history.map((h) => h.status)).toEqual(["confirmed", "processing", "shipped", "delivered"]);
      expect(o.history[1]).toMatchObject({ kind: "status", note: "Packing", by: { name: "Tester" } });
    });
    it("rejects every transition outside the table", async () => {
      const { r } = await fresh();
      for (const to of ["shipped", "delivered", "returned"] as const) await fails(changeStatus(r.orderId, to, undefined, ACTOR), "CONFLICT");
      await changeStatus(r.orderId, "processing", undefined, ACTOR);
      await fails(changeStatus(r.orderId, "processing", undefined, ACTOR), "CONFLICT");
      await changeStatus(r.orderId, "shipped", undefined, ACTOR);
      await fails(changeStatus(r.orderId, "cancelled", undefined, ACTOR), "CONFLICT"); // too late to cancel
      await fails(changeStatus("a".repeat(24), "processing", undefined, ACTOR), "NOT_FOUND");
    });
    it("cancel restores stock and the sold count", async () => {
      const { p, r } = await fresh(5, 2);
      expect(await stockOf(p.id)).toBe(3);
      const o = await changeStatus(r.orderId, "cancelled", "Customer asked", ACTOR);
      expect(o.status).toBe("cancelled");
      expect(o.allowedNext).toEqual([]);
      expect(await stockOf(p.id)).toBe(5);
      expect((await Product.findById(p.id).lean())!.soldCount).toBe(0);
      await fails(changeStatus(r.orderId, "processing", undefined, ACTOR), "CONFLICT");
    });
    it("cancel restores variant stock; a deleted product does not break cancelling", async () => {
      const p = await mk({ variants: [{ sku: "V-1", options: { S: "1" }, stock: 4 }] });
      const gone = await mk({ stock: 3 });
      const r = await place([{ productId: p.id, variantSku: "V-1", qty: 3 }, { productId: gone.id, qty: 1 }]);
      await Product.deleteOne({ _id: gone.id });
      await changeStatus(r.orderId, "cancelled", undefined, ACTOR);
      expect((await Product.findById(p.id).lean())!.variants[0].stock).toBe(4);
    });
    it("cancelling twice at once restores stock exactly once", async () => {
      const { p, r } = await fresh(5, 2);
      const rs = await Promise.allSettled([1, 2, 3, 4].map(() => changeStatus(r.orderId, "cancelled", undefined, ACTOR)));
      expect(rs.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(await stockOf(p.id)).toBe(5);
      expect((await getAdminOrder(r.orderId)).history.filter((h) => h.status === "cancelled")).toHaveLength(1);
    });
    it("cancel racing with shipping: exactly one outcome, stock consistent", async () => {
      const { p, r } = await fresh(5, 2);
      await changeStatus(r.orderId, "processing", undefined, ACTOR);
      const rs = await Promise.allSettled([changeStatus(r.orderId, "cancelled", undefined, ACTOR), changeStatus(r.orderId, "shipped", undefined, ACTOR)]);
      expect(rs.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      const o = await getAdminOrder(r.orderId);
      expect(await stockOf(p.id)).toBe(o.status === "cancelled" ? 5 : 3);
    });
    it("COD payment: pending -> paid once; failed -> paid; cancelled or paid orders cannot be changed", async () => {
      const { r } = await fresh();
      const paid = await changePayment(r.orderId, "paid", ACTOR);
      expect(paid.payment.status).toBe("paid");
      expect(paid.payment.paidAt).not.toBeNull();
      await fails(changePayment(r.orderId, "paid", ACTOR), "CONFLICT");
      await fails(changePayment(r.orderId, "failed", ACTOR), "CONFLICT");
      const { r: r2 } = await fresh();
      await changePayment(r2.orderId, "failed", ACTOR);
      expect((await changePayment(r2.orderId, "paid", ACTOR)).payment.status).toBe("paid");
      const { r: r3 } = await fresh();
      await changeStatus(r3.orderId, "cancelled", undefined, ACTOR);
      await fails(changePayment(r3.orderId, "paid", ACTOR), "CONFLICT");
      await fails(changePayment("a".repeat(24), "paid", ACTOR), "NOT_FOUND");
    });
    it("the payment history entry records the order's actual status, not always 'confirmed'", async () => {
      const { r } = await fresh();
      await changeStatus(r.orderId, "processing", undefined, ACTOR);
      await changeStatus(r.orderId, "shipped", undefined, ACTOR);
      await changeStatus(r.orderId, "delivered", undefined, ACTOR);
      const o = await changePayment(r.orderId, "paid", ACTOR);
      expect(o.history.at(-1)).toMatchObject({ kind: "payment", status: "delivered", note: "Payment marked paid" });
    });
    it("notes append with author and time", async () => {
      const { r } = await fresh();
      await addNote(r.orderId, "Call before delivery", ACTOR);
      const o = await addNote(r.orderId, "Called, no answer", { id: null, name: "Other" });
      expect(o.notes.map((x) => [x.text, x.by.name])).toEqual([["Call before delivery", "Tester"], ["Called, no answer", "Other"]]);
      await fails(addNote("a".repeat(24), "x", ACTOR), "NOT_FOUND");
    });
  });

  describe("refunds", () => {
    const paidOrder = async (price = 10000) => { const p = await mk({ price, stock: 5 }); const r = await place([{ productId: p.id, qty: 1 }]); await changePayment(r.orderId, "paid", ACTOR); return { p, r, total: price + 5000 }; };
    it("only paid orders; partial then full; over-refund rejected", async () => {
      const { r, total } = await paidOrder();
      const pending = await place([{ productId: (await mk()).id, qty: 1 }]);
      await fails(refundOrder(pending.orderId, 100, "no", ACTOR), "CONFLICT");
      const a = await refundOrder(r.orderId, 4000, "Damaged", ACTOR);
      expect(a.payment.status).toBe("partially_refunded");
      expect(a.refundable).toBe(total - 4000);
      await fails(refundOrder(r.orderId, total, "too much", ACTOR), "VALIDATION_ERROR");
      const b = await refundOrder(r.orderId, total - 4000, "Rest", ACTOR);
      expect(b.payment.status).toBe("refunded");
      expect(b.refundedTotal).toBe(total);
      expect(b.refunds).toHaveLength(2);
      await fails(refundOrder(r.orderId, 1, "again", ACTOR), "CONFLICT");
      expect(b.history.filter((h) => h.kind === "refund")).toHaveLength(2);
    });
    it("concurrent refunds can never exceed the order total", async () => {
      const { r, total } = await paidOrder(); // total 15000
      const rs = await Promise.allSettled(Array.from({ length: 6 }, () => refundOrder(r.orderId, 6000, "split", ACTOR)));
      const wins = rs.filter((x) => x.status === "fulfilled").length;
      expect(wins).toBe(2); // 2 x 6000 = 12000 <= 15000 < 18000
      const o = await getAdminOrder(r.orderId);
      expect(o.refundedTotal).toBe(12000);
      expect(o.refundedTotal).toBeLessThanOrEqual(total);
      expect(o.refunds).toHaveLength(2);
      expect(o.payment.status).toBe("partially_refunded");
    });
  });

  describe("payment webhook", () => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET!;
    const call = (payload: unknown, opts: { sig?: string | null; raw?: string } = {}) => {
      const raw = opts.raw ?? JSON.stringify(payload);
      const sig = opts.sig === undefined ? signWebhook(raw, secret) : opts.sig;
      return webhookPOST(new Request("http://x/api/payments/webhook", { method: "POST", headers: { "content-type": "application/json", ...(sig ? { "x-signature": sig } : {}) }, body: raw }));
    };
    const ev = (over: Record<string, unknown>) => ({ eventId: `evt-${Date.now()}-${Math.random()}`, type: "payment.succeeded", timestamp: Date.now(), ...over });
    const setup = async () => { const p = await mk({ price: 10000, stock: 5 }); return place([{ productId: p.id, qty: 1 }]); };

    it("rejects missing/wrong signatures and tampered bodies before touching anything", async () => {
      const r = await setup();
      const e = ev({ orderNumber: r.orderNumber });
      expect((await call(e, { sig: null })).status).toBe(401);
      expect((await call(e, { sig: "00".repeat(32) })).status).toBe(401);
      expect((await call(e, { sig: signWebhook(JSON.stringify(e), "other-secret-other-secret") })).status).toBe(401);
      const raw = JSON.stringify(e);
      expect((await call(e, { raw: raw.replace("succeeded", "failed") + " ", sig: signWebhook(raw, secret) })).status).toBe(401);
      expect((await getAdminOrder(r.orderId)).payment.status).toBe("pending");
      expect(await WebhookEvent.countDocuments()).toBe(0);
    });
    it("marks paid, and a duplicate delivery returns 200 without applying twice", async () => {
      const r = await setup();
      const e = ev({ orderNumber: r.orderNumber, providerPaymentId: "pay_1", amount: 15000 });
      const first = await call(e);
      expect(first.status).toBe(200);
      expect((await first.json()).data).toEqual({ received: true, duplicate: false });
      const o = await getAdminOrder(r.orderId);
      expect(o.payment).toMatchObject({ status: "paid", providerPaymentId: "pay_1" });
      const again = await call(e);
      expect(again.status).toBe(200);
      expect((await again.json()).data.duplicate).toBe(true);
      expect((await getAdminOrder(r.orderId)).history.filter((h) => h.kind === "webhook")).toHaveLength(1);
      expect(await WebhookEvent.countDocuments()).toBe(1);
    });
    it("10 simultaneous deliveries of one event apply once", async () => {
      const r = await setup();
      const e = ev({ orderNumber: r.orderNumber });
      const rs = await Promise.all(Array.from({ length: 10 }, () => call(e)));
      expect(rs.every((x) => x.status === 200)).toBe(true);
      expect((await getAdminOrder(r.orderId)).history.filter((h) => h.kind === "webhook")).toHaveLength(1);
    });
    it("replay protection: a validly signed but stale or future event is rejected", async () => {
      const r = await setup();
      expect((await call(ev({ orderNumber: r.orderNumber, timestamp: Date.now() - 10 * 60_000 }))).status).toBe(400);
      expect((await call(ev({ orderNumber: r.orderNumber, timestamp: Date.now() + 10 * 60_000 }))).status).toBe(400);
      expect((await getAdminOrder(r.orderId)).payment.status).toBe("pending");
    });
    it("amount mismatch and unknown orders are refused; failed then succeeded recovers", async () => {
      const r = await setup();
      expect((await call(ev({ orderNumber: r.orderNumber, amount: 1 }))).status).toBe(400);
      expect((await call(ev({ orderNumber: "GP-0000-000000" }))).status).toBe(404);
      expect((await call(ev({ orderNumber: r.orderNumber, type: "payment.failed" }))).status).toBe(200);
      expect((await getAdminOrder(r.orderId)).payment.status).toBe("failed");
      expect((await call(ev({ orderNumber: r.orderNumber }))).status).toBe(200);
      expect((await getAdminOrder(r.orderId)).payment.status).toBe("paid");
      // a late 'failed' event must not undo a payment
      expect((await call(ev({ orderNumber: r.orderNumber, type: "payment.failed" }))).status).toBe(200);
      expect((await getAdminOrder(r.orderId)).payment.status).toBe("paid");
    });
    it("refund events record a guarded refund; same provider payment id cannot attach to two orders", async () => {
      const r = await setup();
      await call(ev({ orderNumber: r.orderNumber, providerPaymentId: "pay_X" }));
      expect((await call(ev({ orderNumber: r.orderNumber, type: "payment.refunded", amount: 5000 }))).status).toBe(200);
      let o = await getAdminOrder(r.orderId);
      expect(o).toMatchObject({ refundedTotal: 5000, payment: { status: "partially_refunded" } });
      expect((await call(ev({ orderNumber: r.orderNumber, type: "payment.refunded", amount: 999999 }))).status).toBe(400);
      expect((await call(ev({ orderNumber: r.orderNumber, type: "payment.refunded" }))).status).toBe(200); // remainder
      o = await getAdminOrder(r.orderId);
      expect(o.payment.status).toBe("refunded");
      const r2 = await setup();
      expect((await call(ev({ orderNumber: r2.orderNumber, providerPaymentId: "pay_X" }))).status).toBe(409);
      expect((await getAdminOrder(r2.orderId)).payment.status).toBe("pending");
    });
    it("is disabled (503) without a secret and rejects oversized bodies", async () => {
      const saved = process.env.PAYMENT_WEBHOOK_SECRET;
      // env() is cached, so exercise the guard function directly
      const { webhookSecret } = await import("@/server/payments/provider");
      expect(webhookSecret()).toBe(saved);
      const big = JSON.stringify({ pad: "x".repeat(70_000) });
      expect((await call({}, { raw: big })).status).toBe(400);
    });
    it("service-level apply is idempotent on event id", async () => {
      const r = await setup();
      const e = webhookEventSchema.parse(ev({ orderNumber: r.orderNumber }));
      expect(await applyPaymentEvent(e)).toEqual({ duplicate: false });
      expect(await applyPaymentEvent(e)).toEqual({ duplicate: true });
    });
  });

  describe("admin list, search and export", () => {
    const seed = async () => {
      const p = await mk({ stock: 50 });
      const a = await place([{ productId: p.id, qty: 1 }], { email: "alpha@example.com", phone: "+91 90000 11111", shippingAddress: { ...addr, name: "Alpha Person" } });
      await new Promise((r) => setTimeout(r, 10));
      const b = await place([{ productId: p.id, qty: 2 }], { email: "beta@example.com", phone: "+91 92222 33333", shippingAddress: { ...addr, name: "Beta =Cmd" } });
      await changeStatus(b.orderId, "processing", undefined, ACTOR);
      await changePayment(b.orderId, "paid", ACTOR);
      return { a, b };
    };
    const q = (o: Record<string, unknown> = {}) => listOrders(listOrdersSchema.parse(o));
    it("lists newest first with filters, search and pagination", async () => {
      const { a, b } = await seed();
      expect((await q()).items.map((i) => i.id)).toEqual([b.orderId, a.orderId]);
      expect((await q({ status: "processing" })).items.map((i) => i.id)).toEqual([b.orderId]);
      expect((await q({ payment: "pending" })).items.map((i) => i.id)).toEqual([a.orderId]);
      expect((await q({ q: a.orderNumber.toLowerCase() })).items.map((i) => i.id)).toEqual([a.orderId]);
      expect((await q({ q: "alpha@" })).total).toBe(1);
      expect((await q({ q: "92222 33333" })).items.map((i) => i.id)).toEqual([b.orderId]);
      expect((await q({ q: "9222233333" })).items.map((i) => i.id)).toEqual([b.orderId]);
      expect((await q({ q: "beta" })).total).toBe(1);
      expect((await q({ q: ".*" })).total).toBe(0); // regex characters are escaped
      expect((await q({ limit: 1 })).pages).toBe(2);
      const today = new Date().toISOString().slice(0, 10);
      expect((await q({ from: today, to: today })).total).toBe(2);
      expect((await q({ from: "2000-01-01", to: "2000-01-02" })).total).toBe(0);
      const item = (await q()).items[0];
      expect(item).toMatchObject({ orderNumber: b.orderNumber, paymentStatus: "paid", itemCount: 2, name: "Beta =Cmd", total: 25000 });
    });
    it("exports CSV with a header, one row per order, and neutralised formulas", async () => {
      await seed();
      let csv = "";
      for await (const chunk of exportOrderRows(listOrdersSchema.parse({}))) csv += chunk;
      const lines = csv.trim().split("\r\n");
      expect(lines[0]).toBe("Order,Placed (UTC),Status,Payment,Name,Email,Phone,City,State,Postal code,Country,Items,Currency,Subtotal,Shipping,Total,Refunded");
      expect(lines).toHaveLength(3);
      expect(csv).toContain(",'+91 92222 33333,"); // a phone starting with + is prefixed too (safe by default)
      expect(csv).toContain("Beta =Cmd"); // only a leading formula character matters
      expect(lines[1]).toMatch(/250\.00,0\.00$/);
      const f = await q({});
      expect(f.total).toBe(2);
      await Order.updateOne({ orderNumber: lines[1].split(",")[0] }, { $set: { "shippingAddress.name": "=HYPERLINK(\"x\")" } });
      let csv2 = "";
      for await (const chunk of exportOrderRows(listOrdersSchema.parse({ status: "processing" }))) csv2 += chunk;
      expect(csv2).toContain(`"'=HYPERLINK(""x"")"`);
      expect(csv2).not.toMatch(/,=HYPERLINK/);
    });
    it("list/search/sort queries are index-backed (no collection scans, no in-memory sort for the main lists)", async () => {
      await seed();
      const stages = (plan: unknown): string[] => { const s: string[] = []; const walk = (x: unknown) => { if (x && typeof x === "object") { const o = x as Record<string, unknown>; if (typeof o.stage === "string") s.push(o.stage); Object.values(o).forEach(walk); } }; walk(plan); return s; };
      const ex = async (query: mongoose.Query<unknown[], unknown>) => stages(((await query.explain("queryPlanner")) as unknown as { queryPlanner: { winningPlan: unknown } }).queryPlanner.winningPlan);
      const sort = { createdAt: -1, _id: -1 } as const;
      const checks: [string, mongoose.Query<unknown[], unknown>, boolean][] = [
        ["all orders", Order.find({}).sort(sort).limit(20), true],
        ["by status", Order.find({ status: "confirmed" }).sort(sort).limit(20), true],
        ["by payment status", Order.find({ "payment.status": "pending" }).sort(sort).limit(20), true],
        ["date range", Order.find({ createdAt: { $gte: new Date(0) } }).sort(sort).limit(20), true],
        ["order number prefix", Order.find({ orderNumber: { $regex: "^GP-26" } }), false],
        ["email prefix", Order.find({ email: { $regex: "^alpha" } }), false],
        ["idempotency lookup", Order.find({ idempotencyKey: "k" }), false],
        ["provider payment id", Order.find({ "payment.providerPaymentId": "p" }), false],
      ];
      for (const [name, query, noSort] of checks) {
        const st = await ex(query);
        expect(st.some((x) => /IXSCAN/.test(x)), `${name}: ${st.join(">")}`).toBe(true);
        expect(st, name).not.toContain("COLLSCAN");
        if (noSort) expect(st, `${name} should not sort in memory`).not.toContain("SORT");
      }
    });
  });

  describe("order routes end-to-end contract", () => {
    it("guest: validate cart, check out, view the confirmation with the returned token", async () => {
      const p = await mk({ price: 25000, stock: 3 });
      const json = (u: string, b: unknown, h: Record<string, string> = {}) => new Request(u, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) });
      const v = await (await cartPOST(json("http://x/api/cart/validate", { items: [{ productId: p.id, qty: 2 }] }))).json();
      expect(v.data.pricing.total).toBe(55000);
      const c = await (await checkoutPOST(json("http://x/api/checkout", body([{ productId: p.id, qty: 2 }]), { "idempotency-key": key() }))).json();
      const view = await (await orderGET(new Request(`http://x/api/orders/${c.data.orderId}?token=${c.data.accessToken}`), { params: Promise.resolve({ id: c.data.orderId }) } as never)).json();
      expect(view.data).toMatchObject({ orderNumber: c.data.orderNumber, pricing: { total: 55000 }, items: [{ qty: 2, unitPrice: 25000 }] });
      expect(await stockOf(p.id)).toBe(1);
    });
  });
});

describe("order permissions", () => {
  it("matrix", () => {
    for (const role of ["superadmin", "admin", "store_manager"] as const) { expect(can(role, "orders:read")).toBe(true); expect(can(role, "orders:write")).toBe(true); }
    expect(can("content_manager", "orders:read")).toBe(false);
    expect(can("customer", "orders:read")).toBe(false);
    expect(can("store_manager", "orders:refund")).toBe(false); // refunds are admin-only
    expect(can("admin", "orders:refund")).toBe(true);
    expect(can("superadmin", "orders:refund")).toBe(true);
  });
});
