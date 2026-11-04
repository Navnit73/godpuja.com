// Stage 14, slice 2 — coupons and destination tax rules (PRD v1.1 §5.4, §13).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { Category } from "@/server/models/Category";
import { Counter } from "@/server/models/Counter";
import { Coupon, CouponUse } from "@/server/models/Coupon";
import { Notification } from "@/server/models/Notification";
import { Order } from "@/server/models/Order";
import { Product } from "@/server/models/Product";
import { TaxRule } from "@/server/models/TaxRule";
import { can } from "@/server/auth/permissions";
import { computePricing, finalizePricing, validateCart } from "@/server/services/cart";
import { checkCoupon, couponProblem, createCoupon, deleteCoupon, getCoupon, listCoupons, updateCoupon } from "@/server/services/coupons";
import { flushNotifications } from "@/server/services/notifications";
import { changeStatus, getAdminOrder, getCustomerOrder, placeOrder } from "@/server/services/orders";
import { createProduct } from "@/server/services/products";
import { createTaxRule, deleteTaxRule, listTaxRules, taxTermsFor, updateTaxRule } from "@/server/services/tax";
import { assemble, computeDiscount, computeTax, rateLabel } from "@/lib/pricing";
import { couponSchema, taxRuleSchema, updateCouponSchema } from "@/lib/validation/coupons";
import type { ProductInput } from "@/lib/validation/catalog";
import { checkoutSchema, quoteSchema } from "@/lib/validation/orders";
import { emptySeo } from "@/lib/validation/pages";

const ACTOR = { id: null, name: "Tester" };
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};

// ---------------------------------------------------------------- pure maths
describe("coupon discounts", () => {
  it("percent: whole percent of the goods, rounded down, optionally capped, never above the goods", () => {
    expect(computeDiscount({ type: "percent", value: 10 }, 20000, 5000)).toEqual({ goods: 2000, shipping: 0, total: 2000 });
    expect(computeDiscount({ type: "percent", value: 33 }, 999, 0).goods).toBe(329); // 329.67 rounds down: the shop never over-discounts
    expect(computeDiscount({ type: "percent", value: 10, maxDiscount: 1500 }, 20000, 0).goods).toBe(1500);
    expect(computeDiscount({ type: "percent", value: 100 }, 12345, 5000)).toEqual({ goods: 12345, shipping: 0, total: 12345 });
  });
  it("fixed: a fixed amount, never more than the goods; free shipping: the shipping charge", () => {
    expect(computeDiscount({ type: "fixed", value: 5000 }, 20000, 5000).total).toBe(5000);
    expect(computeDiscount({ type: "fixed", value: 5000 }, 3000, 5000)).toEqual({ goods: 3000, shipping: 0, total: 3000 });
    expect(computeDiscount({ type: "free_shipping", value: 0 }, 20000, 5000)).toEqual({ goods: 0, shipping: 5000, total: 5000 });
    expect(computeDiscount({ type: "free_shipping", value: 0 }, 20000, 0).total).toBe(0);
  });
  it("an empty cart gets no discount", () => {
    for (const type of ["percent", "fixed", "free_shipping"] as const) expect(computeDiscount({ type, value: 50 }, 0, 5000).total).toBe(0);
  });
});

describe("tax", () => {
  const gst = (over = {}) => ({ name: "GST", rateBps: 1800, inclusive: true, appliesToShipping: false, ...over });
  it("inclusive tax is reported but not added; exclusive tax is added", () => {
    expect(computeTax(gst(), 11800, 0)).toEqual({ tax: 1800, added: 0 });
    expect(computeTax(gst({ inclusive: false }), 10000, 0)).toEqual({ tax: 1800, added: 1800 });
    expect(computeTax(gst({ rateBps: 550 }), 10000, 0)).toEqual({ tax: 521, added: 0 }); // 5.5% inside 100.00 = 5.21
  });
  it("taxes shipping only when the rule says so, and never a negative base", () => {
    expect(computeTax(gst({ appliesToShipping: true }), 10000, 5000).tax).toBe(2288);
    expect(computeTax(gst(), 10000, 5000).tax).toBe(1525);
    expect(computeTax(gst(), -50, 0)).toEqual({ tax: 0, added: 0 });
  });
  it("no rule, or a zero rate, means no tax", () => {
    expect(computeTax(null, 10000, 5000)).toEqual({ tax: 0, added: 0 });
    expect(computeTax(gst({ rateBps: 0 }), 10000, 5000)).toEqual({ tax: 0, added: 0 });
  });
  it("rounds half up, once", () => {
    expect(computeTax(gst({ rateBps: 500, inclusive: false }), 10, 0)).toEqual({ tax: 1, added: 1 }); // 0.5
    expect(rateLabel(1800)).toBe("18%");
    expect(rateLabel(550)).toBe("5.5%");
    expect(rateLabel(525)).toBe("5.25%");
  });
  it("the total always adds up (goods − discount + shipping + added tax), for many random carts", () => {
    let seed = 12345;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < 500; i++) {
      const subtotal = 100 + rnd(5_000_000), shipping = rnd(3) === 0 ? 0 : 5000;
      const rule = rnd(3) === 0 ? null : gst({ rateBps: 1 + rnd(5000), inclusive: rnd(2) === 0, appliesToShipping: rnd(2) === 0 });
      const d = computeDiscount({ type: (["percent", "fixed", "free_shipping"] as const)[rnd(3)], value: 1 + rnd(99), maxDiscount: rnd(2) ? 100000 : null }, subtotal, shipping);
      const t = computeTax(rule, subtotal - d.goods, shipping - d.shipping);
      const p = assemble(subtotal, shipping, d, t);
      expect(p.total).toBe(subtotal - d.goods + (shipping - d.shipping) + t.added);
      expect(Number.isInteger(p.total) && Number.isInteger(p.tax)).toBe(true);
      expect(p.total).toBeGreaterThanOrEqual(0);
      expect(d.goods).toBeLessThanOrEqual(subtotal);
      if (rule?.inclusive) expect(t.added).toBe(0);
    }
  });
});

describe("coupon validity", () => {
  const live = { isActive: true, startsAt: null, expiresAt: null, minSubtotal: 0, usageLimit: null, usedCount: 0 };
  const now = new Date("2026-11-10T12:00:00Z");
  it("gives a plain reason for every way a code can fail", () => {
    expect(couponProblem(live, 20000, now)).toBeNull();
    expect(couponProblem(null, 20000, now)).toBe("This code is not valid.");
    expect(couponProblem({ ...live, isActive: false }, 20000, now)).toBe("This code is not valid."); // same as unknown: codes cannot be probed
    expect(couponProblem({ ...live, startsAt: new Date("2026-11-11T00:00:00Z") }, 20000, now)).toBe("This code is not active yet.");
    expect(couponProblem({ ...live, expiresAt: new Date("2026-11-10T12:00:00Z") }, 20000, now)).toBe("This code has expired."); // the end instant itself is already over
    expect(couponProblem({ ...live, usageLimit: 5, usedCount: 5 }, 20000, now)).toBe("This code has been fully used.");
    expect(couponProblem({ ...live, minSubtotal: 50000 }, 49999, now)).toBe("Spend at least ₹500 to use this code.");
    expect(couponProblem({ ...live, minSubtotal: 50000 }, 50000, now)).toBeNull();
  });
});

describe("validation", () => {
  const base = { code: "diwali10", type: "percent", value: 10 };
  it("accepts good coupons and normalises the code", () => {
    const c = couponSchema.parse({ ...base, perCustomerLimit: 1 });
    expect(c).toMatchObject({ code: "DIWALI10", value: 10, maxDiscount: null, minSubtotal: 0, usageLimit: null, startsAt: null, isActive: true });
    expect(couponSchema.safeParse({ code: "FREESHIP", type: "free_shipping", value: 0 }).success).toBe(true);
    expect(couponSchema.safeParse({ code: "FLAT50", type: "fixed", value: 5000, minSubtotal: 20000 }).success).toBe(true);
  });
  it("rejects bad terms with a message on the right field", () => {
    const bad = (o: object) => { const r = couponSchema.safeParse({ ...base, ...o }); return r.success ? null : r.error.issues[0]; };
    expect(bad({ value: 0 })?.path).toEqual(["value"]);
    expect(bad({ value: 101 })?.path).toEqual(["value"]);
    expect(bad({ type: "fixed", value: 0 })?.path).toEqual(["value"]);
    expect(bad({ type: "fixed", value: 500, maxDiscount: 100 })?.path).toEqual(["maxDiscount"]);
    expect(bad({ code: "no" })?.path).toEqual(["code"]);
    expect(bad({ code: "has space" })?.path).toEqual(["code"]);
    expect(bad({ startsAt: "2026-12-02T00:00:00+05:30", expiresAt: "2026-12-01T00:00:00+05:30" })?.path).toEqual(["expiresAt"]);
    expect(bad({ usageLimit: 0 })).not.toBeNull();
    expect(bad({ value: 10.5 })).not.toBeNull();
  });
  it("quote and checkout inputs treat a blank coupon as none", () => {
    const items = [{ productId: "a".repeat(24), qty: 1 }];
    expect(quoteSchema.parse({ items, couponCode: "" }).couponCode).toBeUndefined();
    expect(quoteSchema.parse({ items, couponCode: " save10 ", country: "in" })).toMatchObject({ couponCode: "SAVE10", country: "IN" });
    expect(quoteSchema.safeParse({ items, couponCode: "a b" }).success).toBe(false);
    expect(quoteSchema.safeParse({ items, country: "India" }).success).toBe(false);
  });
  it("tax rules need a real country and a sane rate", () => {
    const ok = { country: "in", name: "GST", rateBps: 1800, inclusive: true, appliesToShipping: false };
    expect(taxRuleSchema.parse(ok).country).toBe("IN");
    for (const o of [{ country: "XX" }, { rateBps: -1 }, { rateBps: 10001 }, { rateBps: 5.5 }, { name: "" }]) expect(taxRuleSchema.safeParse({ ...ok, ...o }).success, JSON.stringify(o)).toBe(false);
  });
  it("permissions: store managers run coupons; only admins touch tax", () => {
    expect(can("store_manager", "coupons:write") && can("admin", "coupons:write") && can("superadmin", "coupons:write")).toBe(true);
    expect(can("store_manager", "tax:write")).toBe(false);
    expect(can("admin", "tax:write") && can("superadmin", "tax:write")).toBe(true);
    for (const r of ["content_manager", "support_agent", "temple_operator", "booking_manager", "customer"] as const) expect(can(r, "coupons:write") || can(r, "tax:write"), r).toBe(false);
  });
  it("updates must carry the version they were based on", () => {
    expect(updateCouponSchema.safeParse({ ...base }).success).toBe(false);
    expect(updateCouponSchema.safeParse({ ...base, baseUpdatedAt: "2026-11-10T12:00:00.000Z" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------- database
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Brass diya", slug: "brass-diya", sku: "DIYA-1", shortDescription: "", description: "", images: [{ url: "https://example.com/a.jpg", alt: "Diya" }], category: null, brand: "",
  price: 10000, salePrice: null, stock: 50, lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [],
  shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const IN = { name: "Asha Rao", line1: "12 MG Road", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "IN" };
let keyN = 0;
const key = () => `s14b-key-${Date.now()}-${++keyN}`;

describe("Stage 14b with the database (godpuja_test)", () => {
  const wipe = () => Promise.all([Order, Product, Category, Counter, Coupon, CouponUse, Notification, TaxRule].map((m) => (m as typeof Order).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Order, Product, Coupon, TaxRule].map((m) => (m as typeof Order).syncIndexes()));
  });
  beforeEach(async () => { await flushNotifications(); await wipe(); });
  afterAll(async () => { await flushNotifications(); await wipe(); await mongoose.disconnect(); });

  let n = 0;
  const mkProduct = (over: Partial<ProductInput> = {}) => { n++; return createProduct(prod({ name: `S14b ${n}`, slug: `s14b-${n}`, sku: `S14B-${n}`, ...over })); };
  const mkCoupon = (over: Record<string, unknown> = {}) => createCoupon(couponSchema.parse({ code: "SAVE10", type: "percent", value: 10, perCustomerLimit: 1, ...over }));
  const mkTax = (over: Record<string, unknown> = {}) => createTaxRule(taxRuleSchema.parse({ country: "IN", name: "GST", rateBps: 500, inclusive: true, appliesToShipping: false, ...over }));
  const order = (productId: string, over: Record<string, unknown> = {}, k = key()) =>
    placeOrder(checkoutSchema.parse({ items: [{ productId, qty: 2 }], email: "asha@example.com", phone: "+91 98765 43210", shippingAddress: IN, billingSameAsShipping: true, paymentMethod: "cod", ...over }), k);
  const used = async (code = "SAVE10") => (await Coupon.findOne({ code }).lean())!.usedCount;

  describe("pricing a cart", () => {
    it("without a code or rule nothing changes (the default for every existing shop)", async () => {
      const p = await mkProduct();
      const r = await validateCart([{ productId: p.id, qty: 2 }], { country: "IN" });
      expect(r.pricing).toMatchObject({ subtotal: 20000, discount: 0, shipping: 5000, tax: 0, taxName: null, total: 25000 });
      expect(r.coupon).toBeNull();
      expect(r.couponError).toBeNull();
    });
    it("applies a valid code and explains a bad one without failing the cart", async () => {
      const p = await mkProduct();
      await mkCoupon();
      const good = await validateCart([{ productId: p.id, qty: 2 }], { couponCode: "save10" });
      expect(good.coupon).toEqual({ code: "SAVE10", type: "percent", discount: 2000 });
      expect(good.pricing).toMatchObject({ discount: 2000, total: 23000 });
      const bad = await validateCart([{ productId: p.id, qty: 2 }], { couponCode: "NOPE" });
      expect(bad.coupon).toBeNull();
      expect(bad.couponError).toBe("This code is not valid.");
      expect(bad.pricing.total).toBe(25000);
      await mkCoupon({ code: "BIG", minSubtotal: 50000 });
      expect((await validateCart([{ productId: p.id, qty: 2 }], { couponCode: "BIG" })).couponError).toMatch(/Spend at least ₹500/);
    });
    it("inclusive tax is shown inside the total; exclusive tax is added; shipping is taxed only if the rule says so", async () => {
      const p = await mkProduct();
      const rule = await mkTax();
      const lines = [{ productId: p.id, qty: 2 }];
      expect((await validateCart(lines, { country: "IN" })).pricing).toMatchObject({ tax: 952, taxName: "GST", taxRateBps: 500, taxInclusive: true, total: 25000 });
      expect((await validateCart(lines, { country: "US" })).pricing).toMatchObject({ tax: 0, taxName: null, total: 25000 }); // no rule for the US
      expect((await validateCart(lines)).pricing.tax).toBe(0); // destination unknown
      await updateTaxRule(rule.id, { ...taxRuleSchema.parse({ country: "IN", name: "GST", rateBps: 1800, inclusive: false, appliesToShipping: true }), baseUpdatedAt: rule.updatedAt });
      expect((await validateCart(lines, { country: "IN" })).pricing).toMatchObject({ tax: 4500, taxInclusive: false, total: 29500 }); // (20000 + 5000) × 18% added
    });
    it("the discount reduces what tax is charged on", async () => {
      const p = await mkProduct();
      await mkCoupon(); await mkTax();
      const r = await validateCart([{ productId: p.id, qty: 2 }], { couponCode: "SAVE10", country: "IN" });
      expect(r.pricing).toMatchObject({ subtotal: 20000, discount: 2000, tax: 857, total: 23000 }); // 5% inside (20000 − 2000)
    });
    it("a switched-off tax rule is ignored", async () => {
      await mkTax({ isActive: false });
      expect(await taxTermsFor("IN")).toBeNull();
      expect(await taxTermsFor(undefined)).toBeNull();
      await mkTax({ country: "NP" });
      expect((await taxTermsFor("np"))?.rateBps).toBe(500);
    });
    it("finalizePricing keeps the base figures it was given", () => {
      const base = computePricing([{ lineTotal: 20000, freeShipping: false, available: true }]);
      const out = finalizePricing(base, computeDiscount({ type: "free_shipping", value: 0 }, 20000, base.shipping), null);
      expect(out).toMatchObject({ subtotal: 20000, discount: 5000, shipping: 5000, total: 20000, freeShippingOver: base.freeShippingOver });
    });
  });

  describe("placing an order with a coupon", () => {
    it("records the discount, tax and a coupon snapshot, and shows them to customer and admin", async () => {
      const p = await mkProduct();
      await mkCoupon(); await mkTax();
      const r = await order(p.id, { couponCode: "save10" });
      const o = await getAdminOrder(r.orderId);
      expect(o.pricing).toMatchObject({ subtotal: 20000, discount: 2000, shipping: 5000, tax: 857, total: 23000, taxName: "GST", taxRateBps: 500, taxInclusive: true });
      expect(o.couponCode).toBe("SAVE10");
      expect(await used()).toBe(1);
      const cust = await getCustomerOrder(r.orderId, (await Order.findById(r.orderId).lean())!.accessToken);
      expect(cust).toMatchObject({ couponCode: "SAVE10", pricing: { discount: 2000, total: 23000 } });
      // The order keeps its own copy: deleting the coupon later changes nothing.
      await deleteCoupon((await Coupon.findOne({ code: "SAVE10" }).lean())!._id.toString());
      expect((await getAdminOrder(r.orderId)).pricing.discount).toBe(2000);
    });
    it("charges exactly what the cart showed, and the order total is what the ledger and webhook compare against", async () => {
      const p = await mkProduct();
      await mkCoupon({ code: "FIVE", type: "fixed", value: 5000 }); await mkTax({ inclusive: false, rateBps: 1800 });
      const quote = await validateCart([{ productId: p.id, qty: 2 }], { couponCode: "FIVE", country: "IN" });
      const r = await order(p.id, { couponCode: "FIVE" });
      expect((await getAdminOrder(r.orderId)).pricing.total).toBe(quote.pricing.total);
      expect(quote.pricing.total).toBe(20000 - 5000 + 5000 + Math.round((15000 * 1800) / 10000));
    });
    it("rejects an invalid code with a field error and takes no stock", async () => {
      const p = await mkProduct({ stock: 5 });
      const e = await fails(order(p.id, { couponCode: "NOPE" }), "VALIDATION_ERROR");
      expect(e.fields).toEqual({ couponCode: "This code is not valid." });
      expect((await Product.findById(p.id).lean())!.stock).toBe(5);
      expect(await Order.countDocuments()).toBe(0);
    });
    it("a failed order does not use up the coupon", async () => {
      const p = await mkProduct({ stock: 1 });
      await mkCoupon();
      await fails(order(p.id, { couponCode: "SAVE10" }), "CONFLICT"); // wants 2, only 1 in stock
      expect(await used()).toBe(0);
      expect(await CouponUse.countDocuments()).toBe(0);
    });
    it("enforces the per-customer limit by email (any letter case), but not across different emails", async () => {
      const p = await mkProduct();
      await mkCoupon();
      await order(p.id, { couponCode: "SAVE10" });
      const again = await fails(order(p.id, { couponCode: "SAVE10", email: "ASHA@Example.com" }), "CONFLICT");
      expect(again.fields).toEqual({ couponCode: "You have already used this code." });
      await order(p.id, { couponCode: "SAVE10", email: "other@example.com" });
      expect(await used()).toBe(2);
      await mkCoupon({ code: "THRICE", perCustomerLimit: 3 });
      for (let i = 0; i < 3; i++) await order(p.id, { couponCode: "THRICE" });
      await fails(order(p.id, { couponCode: "THRICE" }), "CONFLICT");
      await mkCoupon({ code: "ANYONE", perCustomerLimit: null });
      for (let i = 0; i < 4; i++) await order(p.id, { couponCode: "ANYONE" });
    });
    it("two checkouts racing for the last use: exactly one wins and the loser takes no stock", async () => {
      const p = await mkProduct({ stock: 20 });
      await mkCoupon({ usageLimit: 1, perCustomerLimit: null });
      const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => order(p.id, { couponCode: "SAVE10", email: `buyer${i}@example.com` })));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      // Losers get a field error on the coupon (a retried transaction re-checks the code, so it may arrive as validation or conflict).
      expect(results.filter((r) => r.status === "rejected").every((r) => /fully used/.test((r as PromiseRejectedResult).reason.fields?.couponCode ?? ""))).toBe(true);
      expect(await used()).toBe(1);
      expect(await Order.countDocuments()).toBe(1);
      expect((await Product.findById(p.id).lean())!.stock).toBe(18); // only the winner's 2 units
    });
    it("the same customer racing with themselves: one use only", async () => {
      const p = await mkProduct({ stock: 20 });
      await mkCoupon({ perCustomerLimit: 1 });
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => order(p.id, { couponCode: "SAVE10" })));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await used()).toBe(1);
      expect((await CouponUse.find().lean())[0].count).toBe(1);
    });
    it("a retry with the same Idempotency-Key does not use the coupon twice; a different code under the same key is refused", async () => {
      const p = await mkProduct();
      await mkCoupon(); await mkCoupon({ code: "OTHER" });
      const k = key();
      const a = await order(p.id, { couponCode: "SAVE10" }, k);
      const b = await order(p.id, { couponCode: "SAVE10" }, k);
      expect(b.orderId).toBe(a.orderId);
      expect(await used()).toBe(1);
      await fails(order(p.id, { couponCode: "OTHER" }, k), "CONFLICT");
    });
    it("honours the dates and the minimum, at the moment of ordering", async () => {
      const p = await mkProduct();
      await mkCoupon({ code: "FUTURE", startsAt: new Date(Date.now() + 3600_000).toISOString() });
      await mkCoupon({ code: "PAST", expiresAt: new Date(Date.now() - 1000).toISOString(), startsAt: new Date(Date.now() - 3600_000).toISOString() });
      await mkCoupon({ code: "BIG", minSubtotal: 50000 });
      await mkCoupon({ code: "OFF", isActive: false });
      for (const [code, msg] of [["FUTURE", /not active yet/], ["PAST", /expired/], ["BIG", /Spend at least/], ["OFF", /not valid/]] as const) {
        const e = await fails(order(p.id, { couponCode: code }), "VALIDATION_ERROR");
        expect(e.fields!.couponCode, code).toMatch(msg);
      }
    });
    it("free-shipping coupons take the shipping charge off", async () => {
      const p = await mkProduct();
      await mkCoupon({ code: "SHIPFREE", type: "free_shipping", value: 0 });
      const r = await order(p.id, { couponCode: "SHIPFREE" });
      expect((await getAdminOrder(r.orderId)).pricing).toMatchObject({ subtotal: 20000, discount: 5000, shipping: 5000, total: 20000 });
    });
  });

  describe("cancelling", () => {
    it("gives the coupon use back so the customer can use it again", async () => {
      const p = await mkProduct();
      await mkCoupon();
      const r = await order(p.id, { couponCode: "SAVE10" });
      expect(await used()).toBe(1);
      await changeStatus(r.orderId, "cancelled", undefined, ACTOR);
      expect(await used()).toBe(0);
      expect((await CouponUse.find().lean())[0].count).toBe(0);
      await order(p.id, { couponCode: "SAVE10" }); // works again
      expect(await used()).toBe(1);
    });
    it("an order without a coupon cancels as before, and a released coupon never goes below zero", async () => {
      const p = await mkProduct();
      const r = await order(p.id);
      await changeStatus(r.orderId, "cancelled", undefined, ACTOR);
      expect(await Coupon.countDocuments()).toBe(0);
      await mkCoupon();
      const r2 = await order(p.id, { couponCode: "SAVE10" });
      await Coupon.updateOne({ code: "SAVE10" }, { $set: { usedCount: 0 } }); // counter reset by hand
      await changeStatus(r2.orderId, "cancelled", undefined, ACTOR);
      expect(await used()).toBe(0);
    });
  });

  describe("admin coupons", () => {
    it("creates, lists, edits and deletes; the code is unique and fixed", async () => {
      const c = await mkCoupon({ description: "Diwali" });
      expect(c).toMatchObject({ code: "SAVE10", usedCount: 0, perCustomerLimit: 1, isActive: true });
      const dup = await fails(mkCoupon(), "CONFLICT");
      expect(dup.fields).toEqual({ code: "Already in use" });
      expect((await listCoupons()).map((x) => x.code)).toEqual(["SAVE10"]);
      const edit = (over: Record<string, unknown>, base = c.updatedAt) => updateCoupon(c.id, { ...couponSchema.parse({ code: "SAVE10", type: "percent", value: 10, ...over }), baseUpdatedAt: base });
      const v2 = await edit({ value: 15, isActive: false });
      expect(v2).toMatchObject({ value: 15, isActive: false, code: "SAVE10" });
      expect(await fails(edit({ value: 20 }), "CONFLICT")).toBeInstanceOf(ApiError); // stale version
      const changed = await fails(updateCoupon(c.id, { ...couponSchema.parse({ code: "RENAMED", type: "percent", value: 10 }), baseUpdatedAt: v2.updatedAt }), "VALIDATION_ERROR"); // current version, but a different code
      expect(changed.fields).toEqual({ code: "Cannot be changed" });
      expect((await getCoupon(c.id)).code).toBe("SAVE10");
      await deleteCoupon(c.id);
      await fails(getCoupon(c.id), "NOT_FOUND");
      await fails(deleteCoupon(c.id), "NOT_FOUND");
      await fails(getCoupon("nope"), "NOT_FOUND");
    });
    it("deleting a coupon also clears its per-customer counters", async () => {
      const p = await mkProduct();
      const c = await mkCoupon();
      await order(p.id, { couponCode: "SAVE10" });
      expect(await CouponUse.countDocuments()).toBe(1);
      await deleteCoupon(c.id);
      expect(await CouponUse.countDocuments()).toBe(0);
    });
    it("checkCoupon finds codes in any letter case and reports why not", async () => {
      await mkCoupon({ code: "MiXed" });
      expect("coupon" in (await checkCoupon(" mixed ", 20000, 5000))).toBe(true);
      expect(await checkCoupon("missing", 20000, 5000)).toEqual({ error: "This code is not valid." });
    });
  });

  describe("admin tax rules", () => {
    it("one rule per country; edit, switch off and delete", async () => {
      const r = await mkTax();
      expect(r).toMatchObject({ country: "IN", rateBps: 500, inclusive: true });
      const dup = await fails(mkTax(), "CONFLICT");
      expect(dup.fields).toEqual({ country: "Already has a rule" });
      await mkTax({ country: "US", name: "Sales tax", rateBps: 725, inclusive: false });
      expect((await listTaxRules()).map((x) => x.country)).toEqual(["IN", "US"]);
      const v2 = await updateTaxRule(r.id, { ...taxRuleSchema.parse({ country: "IN", name: "GST", rateBps: 1800, inclusive: true, appliesToShipping: false }), baseUpdatedAt: r.updatedAt });
      expect(v2.rateBps).toBe(1800);
      await fails(updateTaxRule(r.id, { ...taxRuleSchema.parse({ country: "IN", name: "GST", rateBps: 100, inclusive: true, appliesToShipping: false }), baseUpdatedAt: r.updatedAt }), "CONFLICT"); // stale
      const moved = await fails(updateTaxRule(r.id, { ...taxRuleSchema.parse({ country: "NP", name: "VAT", rateBps: 100, inclusive: true, appliesToShipping: false }), baseUpdatedAt: v2.updatedAt }), "VALIDATION_ERROR");
      expect(moved.fields).toEqual({ country: "Cannot be changed" });
      await deleteTaxRule(r.id);
      await fails(deleteTaxRule(r.id), "NOT_FOUND");
      expect(await taxTermsFor("IN")).toBeNull();
    });
    it("past orders keep their tax figures when the rule changes or is deleted", async () => {
      const p = await mkProduct();
      const rule = await mkTax();
      const r = await order(p.id);
      await deleteTaxRule(rule.id);
      expect((await getAdminOrder(r.orderId)).pricing).toMatchObject({ tax: 952, taxName: "GST", taxInclusive: true });
    });
  });
});
