// Stage 14, slice 1 — /shop URLs, shipment tracking, customer cancel/return, invoices (PRD v1.1 §3.1, §5.4).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { Category } from "@/server/models/Category";
import { Counter } from "@/server/models/Counter";
import { Notification } from "@/server/models/Notification";
import { Order } from "@/server/models/Order";
import { Product } from "@/server/models/Product";
import { Redirect } from "@/server/models/Redirect";
import { User } from "@/server/models/User";
import { proxy } from "@/proxy";
import { _resetRouteCache } from "@/server/route-check";
import { createCategory } from "@/server/services/categories";
import { addShipment, cancelMyOrder, orderActions, removeShipment, requestReturn } from "@/server/services/fulfilment";
import { flushNotifications } from "@/server/services/notifications";
import { changeStatus, getAdminOrder, getCustomerOrder, placeOrder } from "@/server/services/orders";
import { getMyOrder } from "@/server/services/account";
import { createProduct } from "@/server/services/products";
import { carrierName, CARRIERS, trackingLink } from "@/lib/carriers";
import { invoiceable } from "@/lib/order-status";
import { categoryHref, legacyToShop } from "@/lib/shop-url";
import { emptyCategory, type ProductInput } from "@/lib/validation/catalog";
import { checkoutSchema, returnRequestSchema, shipmentSchema } from "@/lib/validation/orders";
import { emptySeo } from "@/lib/validation/pages";

const ACTOR = { id: null, name: "Tester" };
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};

// ---------------------------------------------------------------- pure
describe("shop URLs", () => {
  it("maps legacy /category URLs onto /shop", () => {
    expect(categoryHref("kits/diwali")).toBe("/shop/kits/diwali");
    expect(legacyToShop("/category/kits")).toBe("/shop/kits");
    expect(legacyToShop("/category/kits/diwali/small")).toBe("/shop/kits/diwali/small");
    expect(legacyToShop("/category")).toBe("/shop");
    expect(legacyToShop("/category/")).toBe("/shop");
    expect(legacyToShop("/Category/Kits")).toBe("/shop/Kits");
    for (const p of ["/shop/kits", "/categories", "/categoryx/a", "/product/category", "/"]) expect(legacyToShop(p), p).toBeNull();
  });
});

describe("carriers and tracking", () => {
  it("builds tracking links only where the carrier has one, and encodes the number", () => {
    expect(trackingLink("ups", "1Z999AA10123456784")).toBe("https://www.ups.com/track?tracknum=1Z999AA10123456784");
    expect(trackingLink("delhivery", "ab c")).toBe("https://www.delhivery.com/track/package/ab%20c");
    expect(trackingLink("india-post", "EE123456789IN")).toBeNull();
    expect(trackingLink("other", "X-12345")).toBeNull();
    expect(CARRIERS.every((c) => carrierName(c.id) === c.name)).toBe(true);
  });
  it("prefers a staff-supplied https page and never uses another scheme", () => {
    expect(trackingLink("other", "X-12345", "https://track.example.com/x")).toBe("https://track.example.com/x");
    expect(trackingLink("other", "X-12345", "javascript:alert(1)")).toBeNull();
    expect(trackingLink("other", "X-12345", "http://insecure.example.com")).toBeNull();
    expect(trackingLink("ups", "1Z1", "ftp://x")).toBe("https://www.ups.com/track?tracknum=1Z1");
  });
  it("validates shipments and return requests", () => {
    expect(shipmentSchema.safeParse({ carrier: "dhl", trackingNumber: " 1234567890 " }).data?.trackingNumber).toBe("1234567890");
    for (const bad of [{ carrier: "pigeon", trackingNumber: "12345" }, { carrier: "dhl", trackingNumber: "12" }, { carrier: "dhl", trackingNumber: "12 345" }, { carrier: "dhl", trackingNumber: "12345", trackingUrl: "http://x.com" }, { carrier: "dhl", trackingNumber: "12345", trackingUrl: "javascript:alert(1)" }])
      expect(shipmentSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    expect(shipmentSchema.safeParse({ carrier: "other", trackingNumber: "12345", trackingUrl: "" }).success).toBe(true);
    expect(returnRequestSchema.safeParse({ reason: "abc" }).success).toBe(false);
    expect(returnRequestSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(returnRequestSchema.parse({ reason: "  Wrong size ordered  " }).reason).toBe("Wrong size ordered");
  });
  it("invoices exist only for confirmed orders", () => {
    for (const s of ["confirmed", "processing", "shipped", "delivered", "return_requested", "returned", "refunded"] as const) expect(invoiceable(s), s).toBe(true);
    for (const s of ["pending_payment", "payment_failed", "cancelled"] as const) expect(invoiceable(s), s).toBe(false);
  });
  it("derives what a customer may still do (cancel early; one return inside the window)", () => {
    const day = 86_400_000, now = Date.parse("2026-11-10T12:00:00Z");
    const delivered = (daysAgo: number, extra = {}) => ({ status: "delivered" as const, deliveredAt: new Date(now - daysAgo * day), ...extra });
    expect(orderActions({ status: "confirmed" }, now)).toEqual({ canCancel: true, canReturn: false, returnDeadline: null });
    expect(orderActions({ status: "processing" }, now).canCancel).toBe(false);
    expect(orderActions({ status: "pending_payment" }, now).canCancel).toBe(true);
    expect(orderActions(delivered(3), now)).toMatchObject({ canCancel: false, canReturn: true, returnDeadline: new Date(now - 3 * day + 7 * day).toISOString() });
    expect(orderActions(delivered(8), now).canReturn).toBe(false);
    expect(orderActions(delivered(8), now).returnDeadline).not.toBeNull(); // shows when it ended
    expect(orderActions(delivered(1, { returnRequest: { status: "declined" } }), now)).toMatchObject({ canReturn: false, returnDeadline: null });
    expect(orderActions({ status: "delivered" }, now).canReturn).toBe(false); // delivered before delivery dates were recorded: no window to measure
  });
});

// ---------------------------------------------------------------- database
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Brass diya", slug: "brass-diya", sku: "DIYA-1", shortDescription: "", description: "", images: [{ url: "https://example.com/a.jpg", alt: "Diya" }], category: null, brand: "",
  price: 10000, salePrice: null, stock: 20, lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [],
  shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const IN = { name: "Asha Rao", line1: "12 MG Road", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "IN" };
let keyN = 0;

describe("Stage 14a with the database (godpuja_test)", () => {
  const wipe = () => Promise.all([Order, Product, Category, Counter, Notification, User, Redirect].map((m) => (m as typeof Order).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Order, Product, Category, User, Redirect].map((m) => (m as typeof Order).syncIndexes()));
  });
  beforeEach(async () => { await flushNotifications(); await wipe(); _resetRouteCache(); });
  afterAll(async () => { await flushNotifications(); await wipe(); await mongoose.disconnect(); });

  let n = 0;
  const mkProduct = (over: Partial<ProductInput> = {}) => { n++; return createProduct(prod({ name: `S14 ${n}`, slug: `s14-${n}`, sku: `S14-${n}`, ...over })); };
  const mkUser = async (email = "asha@example.com") => String((await User.create({ name: "Asha Rao", email, passwordHash: "x", role: "customer" }))._id);
  const mkOrder = async (productId: string, userId: string | null) =>
    placeOrder(checkoutSchema.parse({ items: [{ productId, qty: 2 }], email: "asha@example.com", phone: "+91 98765 43210", shippingAddress: IN, billingSameAsShipping: true, paymentMethod: "cod" }), `s14-key-${Date.now()}-${++keyN}`, { userId });
  const advance = async (id: string, ...to: ("processing" | "shipped" | "delivered")[]) => { for (const s of to) await changeStatus(id, s, undefined, ACTOR); };
  const emails = async (template: string) => { await flushNotifications(); return Notification.find({ template }).lean(); };
  const age = (orderId: string, days: number) => Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(orderId) }, { $set: { deliveredAt: new Date(Date.now() - days * 86_400_000) } });

  describe("proxy", () => {
    const run = (path: string, cookie?: string) => proxy(new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined));
    it("permanently redirects old /category URLs to /shop, keeping the query", async () => {
      for (const [from, to] of [["/category/kits", "/shop/kits"], ["/category/kits/diwali?sort=price-asc&page=2", "/shop/kits/diwali?sort=price-asc&page=2"], ["/category", "/shop"], ["/category/", "/shop"]] as const) {
        const res = await run(from);
        expect(res.status, from).toBe(301);
        expect(new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search).toBe(to);
      }
    });
    it("sends a redirect stored before Stage 14 straight to /shop (one hop)", async () => {
      await Redirect.create({ from: "/category/old", to: "/category/new", code: 301 });
      await Redirect.create({ from: "/legacy", to: "/category/new", code: 301 });
      const a = await run("/category/old");
      expect(a.status).toBe(301);
      expect(new URL(a.headers.get("location")!).pathname).toBe("/shop/new");
      const b = await run("/legacy");
      expect(new URL(b.headers.get("location")!).pathname).toBe("/shop/new");
    });
    it("serves /shop and real categories, 404s unknown ones, and gates /account", async () => {
      await createCategory({ ...emptyCategory, name: "Kits", slug: "kits" });
      expect((await run("/shop")).status).toBe(200);
      expect((await run("/shop/kits")).status).toBe(200);
      const missing = await run("/shop/nope");
      expect(missing.headers.get("x-middleware-rewrite")).toContain("/page-not-found");
      const gated = await run("/account/orders");
      expect(gated.status).toBe(307);
      expect(new URL(gated.headers.get("location")!).pathname).toBe("/login");
      expect(new URL(gated.headers.get("location")!).searchParams.get("next")).toBe("/account/orders");
    });
    it("records new category moves under /shop", async () => {
      const a = await createCategory({ ...emptyCategory, name: "Kits", slug: "kits" });
      expect(a.path).toBe("kits");
      expect((await Redirect.countDocuments({ from: /^\/category\// })) + (await Redirect.countDocuments({ to: /^\/category\// }))).toBe(0);
    });
  });

  describe("shipments", () => {
    it("adds tracking while processing, emails the customer, and shows it in both views", async () => {
      const p = await mkProduct();
      const o = await mkOrder(p.id, null);
      await fails(addShipment(o.orderId, { carrier: "ups", trackingNumber: "1Z999AA10123456784" }, ACTOR), "CONFLICT"); // still only confirmed
      await advance(o.orderId, "processing");
      const a = await addShipment(o.orderId, { carrier: "ups", trackingNumber: "1Z999AA10123456784" }, ACTOR);
      expect(a.shipments).toHaveLength(1);
      expect(a.shipments[0]).toMatchObject({ carrier: "ups", trackingNumber: "1Z999AA10123456784", link: "https://www.ups.com/track?tracknum=1Z999AA10123456784", by: "Tester" });
      expect(a.status).toBe("processing"); // marking shipped stays a separate, explicit step
      expect(a.history.at(-1)).toMatchObject({ kind: "shipment", note: "Tracking added: ups 1Z999AA10123456784" });
      const mail = await emails("order.shipment");
      expect(mail).toHaveLength(1);
      expect(mail[0]).toMatchObject({ to: "asha@example.com", ref: { kind: "order", id: o.orderId } });
      const cust = await getCustomerOrder(o.orderId, (await Order.findById(o.orderId).lean())!.accessToken);
      expect(cust.shipments.map((s) => s.trackingNumber)).toEqual(["1Z999AA10123456784"]);
    });
    it("rejects a duplicate tracking number and wrong states; removing works and is logged", async () => {
      const p = await mkProduct();
      const o = await mkOrder(p.id, null);
      await advance(o.orderId, "processing");
      const s1 = await addShipment(o.orderId, { carrier: "india-post", trackingNumber: "EE123456789IN" }, ACTOR);
      const dup = await fails(addShipment(o.orderId, { carrier: "dhl", trackingNumber: "EE123456789IN" }, ACTOR), "CONFLICT");
      expect(dup.fields).toEqual({ trackingNumber: "Already added" });
      const two = await addShipment(o.orderId, { carrier: "other", trackingNumber: "ABC-12345", trackingUrl: "https://track.example.com/ABC-12345" }, ACTOR);
      expect(two.shipments[1].link).toBe("https://track.example.com/ABC-12345");
      const after = await removeShipment(o.orderId, s1.shipments[0].id, ACTOR);
      expect(after.shipments.map((s) => s.trackingNumber)).toEqual(["ABC-12345"]);
      expect(after.history.at(-1)).toMatchObject({ kind: "shipment", note: "Tracking removed" });
      await fails(removeShipment(o.orderId, "does-not-exist", ACTOR), "NOT_FOUND");
      await changeStatus(o.orderId, "cancelled", undefined, ACTOR);
      await fails(addShipment(o.orderId, { carrier: "dhl", trackingNumber: "NEW-12345" }, ACTOR), "CONFLICT"); // cancelled
      await fails(addShipment(new mongoose.Types.ObjectId().toString(), { carrier: "dhl", trackingNumber: "NEW-12345" }, ACTOR), "NOT_FOUND");
    });
  });

  describe("delivery date and return decisions", () => {
    it("records deliveredAt when delivered, not when a return is declined", async () => {
      const p = await mkProduct();
      const o = await mkOrder(p.id, await mkUser());
      expect((await getAdminOrder(o.orderId)).deliveredAt).toBeNull();
      await advance(o.orderId, "processing", "shipped");
      expect((await getAdminOrder(o.orderId)).deliveredAt).toBeNull();
      await advance(o.orderId, "delivered");
      const delivered = (await getAdminOrder(o.orderId)).deliveredAt!;
      expect(Date.parse(delivered)).toBeGreaterThan(Date.now() - 60_000);
      await changeStatus(o.orderId, "return_requested", "Customer phoned", ACTOR);
      await changeStatus(o.orderId, "delivered", "Outside policy", ACTOR); // declined
      expect((await getAdminOrder(o.orderId)).deliveredAt).toBe(delivered);
    });
    it("a staff-recorded return becomes a request that can be accepted", async () => {
      const p = await mkProduct();
      const o = await mkOrder(p.id, null);
      await advance(o.orderId, "processing", "shipped", "delivered");
      const r = await changeStatus(o.orderId, "return_requested", "Damaged on arrival", ACTOR);
      expect(r.returnRequest).toMatchObject({ status: "requested", reason: "Damaged on arrival", source: "staff" });
      const done = await changeStatus(o.orderId, "returned", "Pickup booked", ACTOR);
      expect(done.returnRequest).toMatchObject({ status: "accepted", decisionNote: "Pickup booked" });
      expect((await emails("order.return_accepted"))).toHaveLength(1);
    });
  });

  describe("customer returns", () => {
    const delivered = async () => {
      const p = await mkProduct();
      const uid = await mkUser();
      const o = await mkOrder(p.id, uid);
      await advance(o.orderId, "processing", "shipped", "delivered");
      return { uid, o };
    };
    it("lets the owner request one return inside the window, and staff decide", async () => {
      const { uid, o } = await delivered();
      expect((await getMyOrder(uid, o.orderId)).actions).toMatchObject({ canReturn: true, canCancel: false });
      await requestReturn(uid, "Asha Rao", o.orderId, "Wrong size for my altar");
      const view = await getMyOrder(uid, o.orderId);
      expect(view.status).toBe("return_requested");
      expect(view.returnRequest).toMatchObject({ status: "requested", reason: "Wrong size for my altar" });
      expect(view.actions.canReturn).toBe(false);
      const admin = await getAdminOrder(o.orderId);
      expect(admin.history.at(-1)).toMatchObject({ kind: "return", status: "return_requested", note: "Wrong size for my altar", by: { id: uid, name: "Asha Rao" } });
      expect(admin.returnRequest).toMatchObject({ source: "customer" });
      expect(await emails("order.return_requested")).toHaveLength(1);
      await fails(requestReturn(uid, "Asha Rao", o.orderId, "Trying again please"), "CONFLICT"); // already requested

      const declined = await changeStatus(o.orderId, "delivered", "Used items cannot be returned", ACTOR);
      expect(declined.returnRequest).toMatchObject({ status: "declined", decisionNote: "Used items cannot be returned" });
      expect(await emails("order.return_declined")).toHaveLength(1);
      expect((await emails("order.status.delivered")).length).toBe(1); // only the original delivery email, not a second "delivered"
      const err = await fails(requestReturn(uid, "Asha Rao", o.orderId, "Please reconsider this"), "CONFLICT");
      expect(err.message).toMatch(/already reviewed/);
      expect((await getMyOrder(uid, o.orderId)).actions.canReturn).toBe(false);
    });
    it("refuses an expired window, an undelivered order and someone else's order", async () => {
      const { uid, o } = await delivered();
      await age(o.orderId, 8);
      const late = await fails(requestReturn(uid, "Asha Rao", o.orderId, "Too late but trying"), "CONFLICT");
      expect(late.message).toMatch(/7-day return period/);
      expect((await getAdminOrder(o.orderId)).status).toBe("delivered");

      const p = await mkProduct();
      const open = await mkOrder(p.id, uid);
      const early = await fails(requestReturn(uid, "Asha Rao", open.orderId, "Not delivered yet"), "CONFLICT");
      expect(early.message).toMatch(/after delivery/);

      await age(o.orderId, 1);
      const stranger = await mkUser("stranger@example.com");
      await fails(requestReturn(stranger, "Mallory", o.orderId, "It is not my order"), "NOT_FOUND");
      expect((await getAdminOrder(o.orderId)).status).toBe("delivered");
    });
    it("two simultaneous requests: exactly one is recorded", async () => {
      const { uid, o } = await delivered();
      const r = await Promise.allSettled(Array.from({ length: 4 }, () => requestReturn(uid, "Asha Rao", o.orderId, "Wrong size for my altar")));
      expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect((await getAdminOrder(o.orderId)).history.filter((h) => h.kind === "return")).toHaveLength(1);
      expect(await emails("order.return_requested")).toHaveLength(1);
    });
  });

  describe("customer cancellation", () => {
    it("cancels before processing, returns the stock, and emails once", async () => {
      const p = await mkProduct({ stock: 5 });
      const uid = await mkUser();
      const o = await mkOrder(p.id, uid);
      expect((await Product.findById(p.id).lean())!.stock).toBe(3);
      expect((await getMyOrder(uid, o.orderId)).actions.canCancel).toBe(true);
      const r = await cancelMyOrder(uid, "Asha Rao", o.orderId);
      expect(r.status).toBe("cancelled");
      expect(r.history.at(-1)).toMatchObject({ note: "Cancelled by the customer", by: { id: uid } });
      expect((await Product.findById(p.id).lean())!.stock).toBe(5);
      await fails(cancelMyOrder(uid, "Asha Rao", o.orderId), "CONFLICT");
      expect((await Product.findById(p.id).lean())!.stock).toBe(5); // not restored twice
      expect(await emails("order.status.cancelled")).toHaveLength(1);
    });
    it("is refused once processing has started, and for someone else's order", async () => {
      const p = await mkProduct();
      const uid = await mkUser();
      const o = await mkOrder(p.id, uid);
      await fails(cancelMyOrder(await mkUser("other@example.com"), "Other", o.orderId), "NOT_FOUND");
      await advance(o.orderId, "processing");
      const err = await fails(cancelMyOrder(uid, "Asha Rao", o.orderId), "CONFLICT");
      expect(err.message).toMatch(/contact us/);
      expect((await getAdminOrder(o.orderId)).status).toBe("processing");
      await fails(cancelMyOrder(uid, "Asha Rao", "not-an-id"), "NOT_FOUND");
    });
    it("a guest order (no account) cannot be touched through the account API", async () => {
      const p = await mkProduct();
      const guest = await mkOrder(p.id, null);
      await fails(cancelMyOrder(await mkUser(), "Asha Rao", guest.orderId), "NOT_FOUND");
    });
  });

  it("the guest confirmation view never includes the account-only actions", async () => {
    const p = await mkProduct();
    const o = await mkOrder(p.id, null);
    const view = await getCustomerOrder(o.orderId, (await Order.findById(o.orderId).lean())!.accessToken);
    expect(Object.keys(view)).not.toContain("actions");
    expect(view).toMatchObject({ shipments: [], returnRequest: null, deliveredAt: null });
  });
});
