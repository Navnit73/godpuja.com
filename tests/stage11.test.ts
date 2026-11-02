import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { _resetSharedRateLimit, pickClientIp, rateLimitShared, rateLimitSharedPeek } from "@/server/rate-limit";
import { RateLimit } from "@/server/models/RateLimit";
import { Category } from "@/server/models/Category";
import { Product } from "@/server/models/Product";
import { AuditLog } from "@/server/models/AuditLog";
import { activeSubtree, categorySnapshot, invalidateCategorySnapshot } from "@/server/services/category-snapshot";
import { findPublicProduct, findPublicProducts } from "@/server/services/products";
import { audit, auditTrail } from "@/server/services/audit";
import { responsive, sized } from "@/lib/image";

beforeAll(async () => {
  await connectDB();
  if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
  await Promise.all([RateLimit.syncIndexes(), Category.syncIndexes(), Product.syncIndexes(), AuditLog.syncIndexes()]);
});
afterAll(async () => {
  await Promise.all([RateLimit.deleteMany({}), Category.deleteMany({}), Product.deleteMany({}), AuditLog.deleteMany({})]);
});

describe("client IP (trusted proxy handling)", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("default: the entry appended by the one trusted proxy; spoofed left entries ignored", () => {
    expect(pickClientIp(h({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" }), { hops: 1 })).toBe("9.9.9.9");
    expect(pickClientIp(h({ "x-forwarded-for": "9.9.9.9" }), { hops: 1 })).toBe("9.9.9.9");
  });
  it("x-real-ip is NOT trusted unless configured (a client could send it)", () => {
    expect(pickClientIp(h({ "x-real-ip": "6.6.6.6", "x-forwarded-for": "9.9.9.9" }), { hops: 1 })).toBe("9.9.9.9");
  });
  it("two hops (CDN + load balancer) take the second entry from the right", () => {
    expect(pickClientIp(h({ "x-forwarded-for": "spoof, 7.7.7.7, 10.0.0.1" }), { hops: 2 })).toBe("7.7.7.7");
    expect(pickClientIp(h({ "x-forwarded-for": "10.0.0.1" }), { hops: 2 })).toBe("unknown");
  });
  it("configured header wins when set; missing header is 'unknown'", () => {
    expect(pickClientIp(h({ "cf-connecting-ip": "5.5.5.5", "x-forwarded-for": "9.9.9.9" }), { header: "cf-connecting-ip", hops: 1 })).toBe("5.5.5.5");
    expect(pickClientIp(h({}), { header: "cf-connecting-ip", hops: 1 })).toBe("unknown");
    expect(pickClientIp(h({}), { hops: 1 })).toBe("unknown");
  });
});

describe("shared rate limiter (MongoDB)", () => {
  beforeEach(() => _resetSharedRateLimit());
  it("counts atomically under concurrency: exactly `limit` of 30 parallel calls pass", async () => {
    const res = await Promise.allSettled(Array.from({ length: 30 }, () => rateLimitShared("par", 10, 60_000)));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    const rejected = res.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.every((r) => r.reason instanceof ApiError && r.reason.code === "RATE_LIMITED")).toBe(true);
    expect(Number((rejected[0].reason as ApiError).headers?.["Retry-After"])).toBeGreaterThan(0);
  });
  it("keys are independent and documents expire via TTL", async () => {
    for (let i = 0; i < 3; i++) await rateLimitShared("a", 3, 60_000);
    await expect(rateLimitShared("a", 3, 60_000)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(rateLimitShared("b", 3, 60_000)).resolves.toBeUndefined();
    const doc = await RateLimit.findOne({ _id: { $regex: /^a@/ } }).lean();
    expect(doc!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const idx = await RateLimit.collection.indexes();
    expect(idx.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
  });
  it("peek never counts; blocks once failures reach the limit", async () => {
    for (let i = 0; i < 20; i++) await rateLimitSharedPeek("fail", 3, 60_000);
    for (let i = 0; i < 3; i++) await rateLimitShared("fail", 3, 60_000);
    await expect(rateLimitSharedPeek("fail", 3, 60_000)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(rateLimitSharedPeek("other", 3, 60_000)).resolves.toBeUndefined();
  });
});

describe("category snapshot", () => {
  let ids: Record<string, mongoose.Types.ObjectId>;
  beforeAll(async () => {
    await Promise.all([Category.deleteMany({}), Product.deleteMany({})]);
    const a = await Category.create({ name: "A", slug: "a", path: "a", level: 1 });
    const b = await Category.create({ name: "B", slug: "b", path: "a/b", level: 2, parent: a._id, isActive: false });
    const c = await Category.create({ name: "C", slug: "c", path: "a/b/c", level: 3, parent: b._id });
    const d = await Category.create({ name: "D", slug: "d", path: "a/d", level: 2, parent: a._id });
    ids = { a: a._id, b: b._id, c: c._id, d: d._id };
    const mk = (slug: string, category: mongoose.Types.ObjectId) =>
      ({ name: slug, slug, sku: slug.toUpperCase(), price: 1000, effectivePrice: 1000, stock: 5, status: "active", category });
    await Product.insertMany([mk("in-d", d._id), mk("in-c", c._id), mk("in-a", a._id)]);
  });
  it("hides a subtree under an inactive category", async () => {
    const s = await categorySnapshot({ fresh: true });
    expect(s.hiddenIds).toEqual(new Set([String(ids.b), String(ids.c)]));
    expect(activeSubtree(s, "a")!.map(String).sort()).toEqual([String(ids.a), String(ids.d)].sort());
    expect(activeSubtree(s, "a/b")).toBeNull();
    expect(activeSubtree(s, "a/b/c")).toBeNull();
    expect(activeSubtree(s, "nope")).toBeNull();
  });
  it("listings and detail apply it (hidden product absent, breadcrumbs named)", async () => {
    const all = await findPublicProducts({ page: 1, limit: 24, sort: "newest" } as never);
    expect(all.items.map((p) => p.slug).sort()).toEqual(["in-a", "in-d"]);
    expect(await findPublicProduct("in-c")).toBeNull();
    const d = await findPublicProduct("in-d");
    expect(d!.breadcrumbs).toEqual([{ name: "A", path: "a" }, { name: "D", path: "a/d" }]);
  });
  it("is reused within its TTL and refreshed after invalidation", async () => {
    invalidateCategorySnapshot();
    const s1 = await categorySnapshot({ ttlMs: 60_000 });
    await Category.updateOne({ _id: ids.b }, { isActive: true });
    expect(await categorySnapshot({ ttlMs: 60_000 })).toBe(s1); // cached
    invalidateCategorySnapshot();
    const s2 = await categorySnapshot({ ttlMs: 60_000 });
    expect(s2).not.toBe(s1);
    expect(s2.hiddenIds.size).toBe(0);
    await Category.updateOne({ _id: ids.b }, { isActive: false });
    invalidateCategorySnapshot();
  });
});

describe("audit log", () => {
  it("records actor, action, target and changed field names only", async () => {
    const actor = { _id: new mongoose.Types.ObjectId(), name: "Admin" };
    await audit(actor, "user.update", { type: "user", id: "u1" }, ["role", "password"], "9.9.9.9");
    const trail = await auditTrail("user", "u1");
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ action: "user.update", actor: "Admin", fields: ["role", "password"] });
    const raw = await AuditLog.findOne({ "target.id": "u1" }).lean();
    expect(JSON.stringify(raw)).not.toMatch(/hash|\$2[aby]\$/);
  });
});

describe("responsive images", () => {
  const C = "https://res.cloudinary.com/demo/image/upload/v1312461204/godpuja/x.jpg";
  it("adds format/quality/width transforms to Cloudinary delivery URLs", () => {
    expect(sized(C, 320)).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_320/v1312461204/godpuja/x.jpg");
    const r = responsive(C, "50vw", 320);
    expect(r.srcSet!.split(", ")).toHaveLength(3); // 320, 480, 640 (up to 2x the shown width)
    expect(r.sizes).toBe("50vw");
  });
  it("leaves other hosts and already-transformed URLs untouched", () => {
    expect(sized("https://example.com/a.jpg", 320)).toBe("https://example.com/a.jpg");
    const t = "https://res.cloudinary.com/demo/image/upload/c_fill,w_100/v1/x.jpg";
    expect(sized(t, 320)).toBe(t);
    expect(responsive("https://example.com/a.jpg", "50vw", 320)).toEqual({ src: "https://example.com/a.jpg" });
  });
});
