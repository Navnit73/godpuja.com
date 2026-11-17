// Order ↔ customer-account integrity: idempotency keys are bound to their owner, history and claiming.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { Category } from "@/server/models/Category";
import { Counter } from "@/server/models/Counter";
import { Notification } from "@/server/models/Notification";
import { Order } from "@/server/models/Order";
import { Product } from "@/server/models/Product";
import { User } from "@/server/models/User";
import { claimGuestOrders, listMyOrders } from "@/server/services/account";
import { flushNotifications } from "@/server/services/notifications";
import { placeOrder } from "@/server/services/orders";
import { createProduct } from "@/server/services/products";
import { checkoutSchema } from "@/lib/validation/orders";
import { emptySeo } from "@/lib/validation/pages";
import type { ProductInput } from "@/lib/validation/catalog";

const prod = (): ProductInput => ({
  name: "OA diya", slug: "oa-diya", sku: "OA-1", shortDescription: "", description: "", images: [{ url: "https://example.com/a.jpg", alt: "Diya" }], category: null, brand: "",
  price: 10000, salePrice: null, stock: 20, lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [],
  shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo },
});
const IN = { name: "Asha Rao", line1: "12 MG Road", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "IN" };

describe("order / account integrity (godpuja_test)", () => {
  const wipe = () => Promise.all([Order, Product, Category, Counter, Notification, User].map((m) => (m as typeof Order).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Order, Product, Category, User].map((m) => (m as typeof Order).syncIndexes()));
  });
  beforeEach(async () => { await flushNotifications(); await wipe(); });
  afterAll(async () => { await flushNotifications(); await wipe(); await mongoose.disconnect(); });

  const input = (productId: string, email = "asha@example.com") => checkoutSchema.parse({ items: [{ productId, qty: 1 }], email, phone: "+91 98765 43210", shippingAddress: IN, billingSameAsShipping: true, paymentMethod: "cod" });
  const mkUser = async (email: string, verified = true) => String((await User.create({ name: "Asha", email, passwordHash: "x", role: "customer", emailVerifiedAt: verified ? new Date() : null }))._id);

  it("does not replay an order (and its access token) to a different account or to a guest", async () => {
    const p = await createProduct(prod());
    const owner = await mkUser("asha@example.com"), other = await mkUser("other@example.com");
    const first = await placeOrder(input(p.id), "oa-key-0001", { userId: owner });
    const same = await placeOrder(input(p.id), "oa-key-0001", { userId: owner });
    expect(same).toMatchObject({ created: false, orderId: first.orderId });
    for (const opts of [{ userId: other }, { userId: null }, {}]) {
      const err = await placeOrder(input(p.id), "oa-key-0001", opts).then(() => null, (e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("CONFLICT");
    }
    expect(await Order.countDocuments()).toBe(1);
  });

  it("links the order to the account and lists it in the customer's history with its payment status", async () => {
    const p = await createProduct(prod());
    const uid = await mkUser("asha@example.com");
    const placed = await placeOrder(input(p.id), "oa-key-0002", { userId: uid });
    const mine = await listMyOrders(uid);
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ id: placed.orderId, paymentStatus: "pending" });
    expect(String((await Order.findById(placed.orderId).lean())!.user)).toBe(uid);
  });

  it("claims guest orders for a verified email (what login now does), never someone else's", async () => {
    const p = await createProduct(prod());
    const uid = await mkUser("asha@example.com");
    await placeOrder(input(p.id), "oa-key-0003");
    await placeOrder(input(p.id, "stranger@example.com"), "oa-key-0004");
    expect(await claimGuestOrders(uid, "asha@example.com")).toBe(1);
    expect((await listMyOrders(uid)).total).toBe(1);
  });
});
