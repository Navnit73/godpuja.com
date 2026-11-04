// Stage 14, slice 3 — reviews and ratings, filters (deity/material/occasion/size/availability/rating), wishlist, recently viewed.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { Category } from "@/server/models/Category";
import { Counter } from "@/server/models/Counter";
import { Notification } from "@/server/models/Notification";
import { Order } from "@/server/models/Order";
import { Product } from "@/server/models/Product";
import { Review } from "@/server/models/Review";
import { User } from "@/server/models/User";
import { WishlistItem } from "@/server/models/WishlistItem";
import { can } from "@/server/auth/permissions";
import { POST as cardsPOST } from "@/app/api/products/cards/route";
import { createCategory } from "@/server/services/categories";
import { flushNotifications } from "@/server/services/notifications";
import { changeStatus, placeOrder } from "@/server/services/orders";
import { findCards, findFacets, findPublicProduct, findPublicProducts, findRelated } from "@/server/services/products";
import { deleteMyReview, deleteReview, displayNameOf, findPublicReviews, getReviewState, listReviews, moderateReview, pendingReviewCount, saveMyReview } from "@/server/services/reviews";
import { addToWishlist, listWishlist, removeFromWishlist, WISHLIST_MAX, wishlistIds } from "@/server/services/wishlist";
import { createProduct, updateProduct } from "@/server/services/products";
import { FACET_KEYS } from "@/lib/facets";
import { productLd } from "@/lib/jsonld";
import { isFiltered, listingHref, parseListing } from "@/lib/listing";
import { averageOf, formatRating, ratingText } from "@/lib/rating";
import { emptyCategory, publicProductsSchema, type ProductInput } from "@/lib/validation/catalog";
import { checkoutSchema } from "@/lib/validation/orders";
import { emptySeo } from "@/lib/validation/pages";
import { moderateSchema, reviewSchema } from "@/lib/validation/reviews";

const ACTOR = { id: null, name: "Tester" };
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};

// ---------------------------------------------------------------- pure
describe("ratings", () => {
  it("averages to two decimals and formats simply", () => {
    expect(averageOf(0, 0)).toBe(0);
    expect(averageOf(14, 3)).toBe(4.67);
    expect(averageOf(10, 2)).toBe(5);
    expect(averageOf(29, 8)).toBe(3.63); // 3.625 rounds up, the same as the stored rating (MongoDB's $round would give 3.62)
    expect(averageOf(1, 3)).toBe(0.33);
    expect(formatRating(4)).toBe("4");
    expect(formatRating(4.67)).toBe("4.7");
    expect(ratingText(4.5, 12)).toBe("Rated 4.5 out of 5 from 12 reviews");
    expect(ratingText(5, 1)).toBe("Rated 5 out of 5 from 1 review");
  });
  it("shows reviewers as first name and last initial", () => {
    expect(displayNameOf("Asha Rao")).toBe("Asha R.");
    expect(displayNameOf("  asha   rao kumar ")).toBe("asha K.");
    expect(displayNameOf("Meera")).toBe("Meera");
    expect(displayNameOf("   ")).toBe("A customer");
    expect(displayNameOf("राम शर्मा")).toBe("राम श.");
  });
  it("validates a review", () => {
    expect(reviewSchema.parse({ rating: 5, body: "  Lovely lamp, very sturdy.  " })).toEqual({ rating: 5, title: "", body: "Lovely lamp, very sturdy." });
    for (const bad of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: 3, body: "short" }, { rating: 3, body: "x".repeat(2001) }, { rating: 3, body: "long enough text", title: "x".repeat(81) }])
      expect(reviewSchema.safeParse({ body: "A fine product indeed", ...bad }).success, JSON.stringify(bad)).toBe(false);
    expect(moderateSchema.safeParse({ status: "pending" }).success).toBe(false);
    expect(moderateSchema.safeParse({ status: "published" }).success).toBe(true);
  });
  it("structured data carries a rating only when published reviews exist", () => {
    const base = { id: "1", name: "Diya", slug: "diya", sku: "D1", shortDescription: "", descriptionHtml: "", images: [], brand: "", price: 60000, salePrice: null, inStock: true, upcoming: false, isFeatured: false, category: null, categoryPath: null, attributes: [], variants: [], seo: { ...emptySeo }, freeShipping: false, breadcrumbs: [] };
    expect(productLd("https://g.com", { ...base, rating: null })).not.toHaveProperty("aggregateRating");
    expect(productLd("https://g.com", { ...base, rating: { avg: 4.5, count: 12 } })).toMatchObject({ aggregateRating: { "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 12, bestRating: 5, worstRating: 1 } });
  });
});

describe("listing query", () => {
  it("reads filters from the URL, ignores bad values, and keeps the rest", () => {
    const q = parseListing({ deity: " Ganesha ", material: "Brass", stock: "1", rating: "4", sort: "rating", size: "" });
    expect(q).toMatchObject({ deity: "Ganesha", material: "Brass", stock: "1", rating: 4, sort: "rating" });
    expect(q.size).toBeUndefined();
    const bad = parseListing({ rating: "9", stock: "yes", deity: "x".repeat(61), sort: "nonsense", material: "Brass" });
    expect(bad).toMatchObject({ material: "Brass", sort: "newest" });
    expect(bad.rating).toBeUndefined();
    expect(bad.stock).toBeUndefined();
    expect(bad.deity).toBeUndefined();
  });
  it("links keep every filter, drop empty ones, and reset to page 1 on change", () => {
    const q = parseListing({ deity: "Ganesha", stock: "1", page: "3", min: "100" });
    expect(listingHref("/shop", q)).toBe("/shop?min=100&page=3&stock=1&deity=Ganesha");
    expect(listingHref("/shop", q, { page: 1, deity: undefined })).toBe("/shop?min=100&stock=1");
    expect(listingHref("/shop", q, { material: "Brass Metal" })).toContain("material=Brass+Metal");
  });
  it("any filter makes a page a near-duplicate (noindex), a plain page is not", () => {
    expect(isFiltered(parseListing({}))).toBe(false);
    expect(isFiltered(parseListing({ page: "2" }))).toBe(false);
    for (const raw of [{ sort: "popular" }, { min: "10" }, { stock: "1" }, { rating: "3" }, ...FACET_KEYS.map((k) => ({ [k]: "x" }))]) expect(isFiltered(parseListing(raw)), JSON.stringify(raw)).toBe(true);
    expect(publicProductsSchema.parse({ sort: "rating" }).sort).toBe("rating");
  });
});

describe("permissions", () => {
  it("store managers and admins moderate reviews; content and support roles do not", () => {
    for (const r of ["store_manager", "admin", "superadmin"] as const) expect(can(r, "reviews:write"), r).toBe(true);
    for (const r of ["content_manager", "support_agent", "booking_manager", "temple_operator", "customer"] as const) expect(can(r, "reviews:write"), r).toBe(false);
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

describe("Stage 14c with the database (godpuja_test)", () => {
  const wipe = () => Promise.all([Order, Product, Category, Counter, Review, User, WishlistItem, Notification].map((m) => (m as typeof Order).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Order, Product, Category, Review, User, WishlistItem].map((m) => (m as typeof Order).syncIndexes()));
  });
  beforeEach(async () => { await flushNotifications(); await wipe(); });
  afterAll(async () => { await flushNotifications(); await wipe(); await mongoose.disconnect(); });

  let n = 0;
  const mk = (over: Partial<ProductInput> = {}) => { n++; return createProduct(prod({ name: `S14c ${n}`, slug: `s14c-${n}`, sku: `S14C-${n}`, ...over })); };
  const attrs = (...pairs: [string, string][]) => pairs.map(([name, value]) => ({ name, value }));
  const mkUser = async (name = "Asha Rao") => { n++; return String((await User.create({ name, email: `u${n}@example.com`, passwordHash: "x", role: "customer" }))._id); };
  const buy = async (userId: string, productId: string, finish: "delivered" | "shipped" | "none" = "delivered") => {
    const o = await placeOrder(checkoutSchema.parse({ items: [{ productId, qty: 1 }], email: `buyer${++n}@example.com`, phone: "+91 98765 43210", shippingAddress: IN, billingSameAsShipping: true, paymentMethod: "cod" }), `s14c-${Date.now()}-${++keyN}`, { userId });
    if (finish !== "none") for (const s of (finish === "delivered" ? ["processing", "shipped", "delivered"] : ["processing", "shipped"]) as ("processing" | "shipped" | "delivered")[]) await changeStatus(o.orderId, s, undefined, ACTOR);
    return o;
  };
  const review = (rating = 5, body = "A really well made lamp, thank you.") => reviewSchema.parse({ rating, body });
  const rating = async (id: string) => { const p = (await Product.findById(id).lean())!; return { count: p.ratingCount, sum: p.ratingSum, avg: p.ratingAvg }; };
  const slugOf = async (id: string) => (await Product.findById(id).lean())!.slug;

  describe("filters", () => {
    it("lists only the values that exist, merging letter case, scoped to what is being browsed", async () => {
      const kits = await createCategory({ ...emptyCategory, name: "Kits", slug: "kits" });
      const idols = await createCategory({ ...emptyCategory, name: "Idols", slug: "idols" });
      await mk({ category: kits.id, attributes: attrs(["Deity", "Ganesha"], ["Material", "Brass"], ["Occasion", "Diwali"]) });
      await mk({ category: kits.id, attributes: attrs(["deity", "ganesha"], ["MATERIAL", "Copper"]) });
      await mk({ category: idols.id, attributes: attrs(["Deity", "Shiva"], ["Size", "Small"], ["Colour", "Red"]) });
      await mk({ attributes: attrs(["Deity", "Hidden draft"]), status: "draft" });
      const all = await findFacets(publicProductsSchema.parse({}));
      expect(all.map((g) => g.key)).toEqual(["deity", "material", "occasion", "size"]); // colour is not a facet; draft ignored
      expect(all.find((g) => g.key === "deity")!.values).toEqual([{ value: "Ganesha", count: 2 }, { value: "Shiva", count: 1 }]);
      expect(all.find((g) => g.key === "material")!.values.map((v) => v.value).sort()).toEqual(["Brass", "Copper"]);
      const inKits = await findFacets(publicProductsSchema.parse({ category: "kits" }));
      expect(inKits.map((g) => g.key)).toEqual(["deity", "material", "occasion"]); // no size among kits: the group is not offered
      expect(inKits.find((g) => g.key === "deity")!.values).toEqual([{ value: "Ganesha", count: 2 }]);
      expect(await findFacets(publicProductsSchema.parse({ category: "nope" }))).toEqual([]);
    });
    it("hides facets of products in inactive categories", async () => {
      const c = await createCategory({ ...emptyCategory, name: "Off", slug: "off", isActive: false });
      await mk({ category: c.id, attributes: attrs(["Deity", "Krishna"]) });
      expect(await findFacets(publicProductsSchema.parse({}))).toEqual([]);
    });
    it("filters by facet value, case-insensitively, and combines filters", async () => {
      const a = await mk({ attributes: attrs(["Deity", "Ganesha"], ["Material", "Brass"]) });
      await mk({ attributes: attrs(["Deity", "Ganesha"], ["Material", "Clay"]) });
      await mk({ attributes: attrs(["Deity", "Shiva"], ["Material", "Brass"]) });
      const ids = async (raw: Record<string, string>) => (await findPublicProducts(parseListing(raw))).items.map((p) => p.id);
      expect((await ids({ deity: "GANESHA" })).length).toBe(2);
      expect((await ids({ deity: "ganesha", material: "brass" }))).toEqual([a.id]);
      expect((await ids({ deity: "Vishnu" })).length).toBe(0);
      expect((await ids({ material: "Brass" })).length).toBe(2);
      expect((await findPublicProducts(parseListing({ deity: "Ganesha" }))).total).toBe(2);
    });
    it("treats a facet value as text, never as a query", async () => {
      await mk({ attributes: attrs(["Deity", "Ganesha"]) });
      for (const v of [".*", "Gane.*", "^G", "(a|b)", "[a-z]+", "Ganesha|Shiva"]) expect((await findPublicProducts(parseListing({ deity: v }))).total, v).toBe(0);
    });
    it("in stock: units on the product, or on any variant", async () => {
      const plain = await mk({ stock: 3 });
      await mk({ stock: 0 });
      const withStock = await mk({ stock: 0, variants: [{ sku: "V-A", options: { size: "S" }, price: null, salePrice: null, stock: 0 }, { sku: "V-B", options: { size: "M" }, price: null, salePrice: null, stock: 2 }] });
      await mk({ stock: 9, variants: [{ sku: "V-C", options: { size: "S" }, price: null, salePrice: null, stock: 0 }] }); // product stock is ignored when it has variants
      const r = await findPublicProducts(parseListing({ stock: "1" }));
      expect(r.items.map((p) => p.id).sort()).toEqual([plain.id, withStock.id].sort());
      expect(r.total).toBe(2);
    });
    it("minimum rating and sort by rating use published reviews only", async () => {
      const [a, b, c] = [await mk(), await mk(), await mk()];
      const u = [await mkUser(), await mkUser(), await mkUser()];
      for (const [pid, uid, stars] of [[a.id, u[0], 5], [a.id, u[1], 4], [b.id, u[0], 3], [c.id, u[2], 5]] as const) {
        await buy(uid, pid);
        const r = await saveMyReview(uid, "X Y", await slugOf(pid), review(stars));
        if (pid !== c.id) await moderateReview(r.review.id, "published", undefined, "Mod"); // c stays pending
      }
      expect((await findPublicProducts(parseListing({ rating: "4" }))).items.map((p) => p.id)).toEqual([a.id]); // a = 4.5; b = 3; c has no published rating
      expect((await findPublicProducts(parseListing({ rating: "3" }))).items.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
      const sorted = (await findPublicProducts(parseListing({ sort: "rating" }))).items;
      expect(sorted.slice(0, 2).map((p) => p.id)).toEqual([a.id, b.id]);
      expect(sorted.find((p) => p.id === a.id)!.rating).toEqual({ avg: 4.5, count: 2 });
      expect(sorted.find((p) => p.id === c.id)!.rating).toBeNull(); // no rating shown without a published review
    });
  });

  describe("reviews", () => {
    it("only a customer with a delivered order can review, and a review waits for approval", async () => {
      const p = await mk();
      const uid = await mkUser();
      expect(await getReviewState(uid, p.slug)).toEqual({ eligible: false, reason: "not_purchased", review: null });
      expect((await fails(saveMyReview(uid, "Asha Rao", p.slug, review()), "FORBIDDEN")).message).toMatch(/received this product/);
      await buy(uid, p.id, "shipped"); // on the way is not delivered
      await fails(saveMyReview(uid, "Asha Rao", p.slug, review()), "FORBIDDEN");
      const other = await mk();
      await buy(uid, other.id); // delivered, but a different product
      await fails(saveMyReview(uid, "Asha Rao", p.slug, review()), "FORBIDDEN");
      await buy(uid, p.id);
      expect((await getReviewState(uid, p.slug)).eligible).toBe(true);
      const r = await saveMyReview(uid, "Asha Rao", p.slug, review(5));
      expect(r).toMatchObject({ created: true, review: { rating: 5, status: "pending" } });
      expect((await Review.findOne().lean())!.displayName).toBe("Asha R.");
      expect(await rating(p.id)).toEqual({ count: 0, sum: 0, avg: 0 }); // not counted yet
      expect((await findPublicReviews(p.id)).items).toHaveLength(0);
      expect(await pendingReviewCount()).toBe(1);
    });
    it("someone else's order, a returned order and guests do not qualify", async () => {
      const p = await mk();
      const a = await mkUser(), b = await mkUser();
      await buy(a, p.id);
      await fails(saveMyReview(b, "B B", p.slug, review()), "FORBIDDEN");
      const guest = await placeOrder(checkoutSchema.parse({ items: [{ productId: p.id, qty: 1 }], email: "g@example.com", phone: "+91 98765 43210", shippingAddress: IN, billingSameAsShipping: true, paymentMethod: "cod" }), `s14c-g-${++keyN}`);
      for (const s of ["processing", "shipped", "delivered"] as const) await changeStatus(guest.orderId, s, undefined, ACTOR);
      await fails(saveMyReview(b, "B B", p.slug, review()), "FORBIDDEN"); // a guest order belongs to nobody's account
      await fails(saveMyReview(a, "A A", "no-such-product", review()), "NOT_FOUND");
    });
    it("publishing adds to the product's rating, unpublishing and deleting take it away", async () => {
      const p = await mk();
      const users = [await mkUser(), await mkUser(), await mkUser()];
      const made = [];
      for (const [i, stars] of [5, 4, 4].entries()) { await buy(users[i], p.id); made.push((await saveMyReview(users[i], "U Ser", p.slug, review(stars))).review.id); }
      for (const id of made) await moderateReview(id, "published", undefined, "Mod");
      expect(await rating(p.id)).toEqual({ count: 3, sum: 13, avg: 4.33 });
      expect((await findPublicProduct(p.slug))!.rating).toEqual({ avg: 4.33, count: 3 });
      await moderateReview(made[0], "rejected", "Spam", "Mod"); // unpublish the 5-star
      expect(await rating(p.id)).toEqual({ count: 2, sum: 8, avg: 4 });
      await fails(moderateReview(made[0], "rejected", undefined, "Mod"), "CONFLICT");
      await deleteReview(made[1]);
      expect(await rating(p.id)).toEqual({ count: 1, sum: 4, avg: 4 });
      await deleteReview(made[2]);
      expect(await rating(p.id)).toEqual({ count: 0, sum: 0, avg: 0 });
      await fails(deleteReview(made[2]), "NOT_FOUND");
      expect(await Review.countDocuments({ product: p.id })).toBe(1); // the rejected one remains until deleted
    });
    it("editing a published review takes its stars out until it is approved again; deleting your own works", async () => {
      const p = await mk();
      const uid = await mkUser();
      await buy(uid, p.id);
      const first = await saveMyReview(uid, "Asha Rao", p.slug, review(5));
      await moderateReview(first.review.id, "published", undefined, "Mod");
      expect(await rating(p.id)).toMatchObject({ count: 1, avg: 5 });
      const edited = await saveMyReview(uid, "Asha Rao", p.slug, review(2, "Changed my mind after a month of use."));
      expect(edited).toMatchObject({ created: false, review: { rating: 2, status: "pending" } });
      expect(await rating(p.id)).toEqual({ count: 0, sum: 0, avg: 0 });
      expect((await Review.findOne().lean())!.moderation).toBeUndefined();
      await moderateReview(edited.review.id, "published", undefined, "Mod");
      expect(await rating(p.id)).toMatchObject({ count: 1, sum: 2, avg: 2 });
      await deleteMyReview(uid, p.slug);
      expect(await rating(p.id)).toMatchObject({ count: 0 });
      await fails(deleteMyReview(uid, p.slug), "NOT_FOUND");
      const stranger = await mkUser();
      await fails(deleteMyReview(stranger, p.slug), "NOT_FOUND");
    });
    it("two simultaneous submissions from one customer make one review", async () => {
      const p = await mk();
      const uid = await mkUser();
      await buy(uid, p.id);
      const rs = await Promise.allSettled(Array.from({ length: 5 }, () => saveMyReview(uid, "Asha Rao", p.slug, review())));
      expect(await Review.countDocuments({ user: uid })).toBe(1);
      expect(rs.some((r) => r.status === "fulfilled")).toBe(true);
    });
    it("many reviews approved at the same moment: the totals are exact, never lost", async () => {
      const p = await mk();
      const stars = [5, 4, 3, 5, 2, 4, 5, 1]; // each reviewer needs a customer and a delivered order, which is slow on a remote database
      const ids: string[] = [];
      for (const s of stars) { const uid = await mkUser(); await buy(uid, p.id); ids.push((await saveMyReview(uid, "Q Z", p.slug, review(s))).review.id); }
      const results = await Promise.allSettled(ids.map((id) => moderateReview(id, "published", undefined, "Mod")));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const sum = (await Review.find({ status: "published" }).lean()).reduce((t, r) => t + r.rating, 0);
      expect(await rating(p.id)).toEqual({ count: ok, sum, avg: averageOf(sum, ok) });
      expect(ok).toBe(stars.length);
      // and the same again, unpublishing all together, returns to zero
      await Promise.all(ids.map((id) => moderateReview(id, "rejected", undefined, "Mod")));
      expect(await rating(p.id)).toEqual({ count: 0, sum: 0, avg: 0 });
    }, 120_000);
    it("the public list shows published reviews only, newest first, with the star breakdown", async () => {
      const p = await mk();
      const made: string[] = [];
      for (const s of [5, 5, 3, 1]) { const uid = await mkUser(`Reviewer${s} Person`); await buy(uid, p.id); made.push((await saveMyReview(uid, `Reviewer${s} Person`, p.slug, review(s, `Review with ${s} stars, written carefully.`))).review.id); }
      for (const id of made.slice(0, 3)) await moderateReview(id, "published", undefined, "Mod");
      const r = await findPublicReviews(p.id);
      expect(r.items.map((x) => x.rating)).toEqual([3, 5, 5]); // newest first, the pending 1-star is absent
      expect(r.summary).toEqual({ count: 3, avg: 4.33, distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 } });
      expect(r.items[0].displayName).toBe("Reviewer3 P.");
      expect(Object.keys(r.items[0]).sort()).toEqual(["body", "createdAt", "displayName", "id", "rating", "title"]); // no user or order ids
    });
    it("the moderation queue is oldest first and names the product", async () => {
      const p = await mk({ name: "Queue product" });
      for (const s of [4, 2]) { const uid = await mkUser(); await buy(uid, p.id); await saveMyReview(uid, "Q R", p.slug, review(s)); await new Promise((r) => setTimeout(r, 5)); }
      const q = await listReviews({ status: "pending", page: 1, limit: 20 });
      expect(q.total).toBe(2);
      expect(q.items.map((r) => r.rating)).toEqual([4, 2]);
      expect(q.items[0]).toMatchObject({ productName: "Queue product", productSlug: p.slug, status: "pending", moderation: null });
      await moderateReview(q.items[0].id, "published", "Good one", "Moderator Mia");
      const done = await listReviews({ status: "published", page: 1, limit: 20 });
      expect(done.items[0].moderation).toMatchObject({ by: "Moderator Mia", note: "Good one" });
      await fails(moderateReview("not-an-id", "published", undefined, "M"), "NOT_FOUND");
    });
    it("a product leaving the shop cannot receive reviews", async () => {
      const p = await mk();
      const uid = await mkUser();
      await buy(uid, p.id);
      await updateProduct(p.id, { ...prod({ name: p.name, slug: p.slug, sku: p.sku }), status: "draft", baseUpdatedAt: p.updatedAt });
      await fails(saveMyReview(uid, "Asha Rao", p.slug, review()), "NOT_FOUND");
    });
  });

  describe("wishlist and recently viewed", () => {
    it("saves and removes products, safely twice, per customer", async () => {
      const [p1, p2] = [await mk(), await mk()];
      const a = await mkUser(), b = await mkUser();
      expect(await addToWishlist(a, p1.id)).toEqual({ added: true });
      expect(await addToWishlist(a, p1.id)).toEqual({ added: false });
      await addToWishlist(a, p2.id);
      expect(await wishlistIds(a)).toEqual([p2.id, p1.id]); // newest first
      expect(await wishlistIds(b)).toEqual([]);
      expect(await removeFromWishlist(a, p1.id)).toEqual({ removed: true });
      expect(await removeFromWishlist(a, p1.id)).toEqual({ removed: false });
      expect(await removeFromWishlist(a, "not-an-id")).toEqual({ removed: false });
      expect(await wishlistIds(a)).toEqual([p2.id]);
    });
    it("the same product added in parallel is saved once", async () => {
      const p = await mk(); const a = await mkUser();
      await Promise.all(Array.from({ length: 6 }, () => addToWishlist(a, p.id)));
      expect(await WishlistItem.countDocuments({ user: a })).toBe(1);
    });
    it("only visible products can be saved, and gone ones drop out of the list", async () => {
      const a = await mkUser();
      const draft = await mk({ status: "draft" });
      await fails(addToWishlist(a, draft.id), "NOT_FOUND");
      await fails(addToWishlist(a, new mongoose.Types.ObjectId().toString()), "NOT_FOUND");
      await fails(addToWishlist(a, "nope"), "NOT_FOUND");
      const p = await mk(); const q = await mk();
      await addToWishlist(a, p.id); await addToWishlist(a, q.id);
      await Product.updateOne({ _id: q.id }, { $set: { status: "archived" } });
      expect((await listWishlist(a)).map((x) => x.id)).toEqual([p.id]);
      const cat = await createCategory({ ...emptyCategory, name: "Gone", slug: "gone", isActive: false });
      await Product.updateOne({ _id: p.id }, { $set: { category: cat.id } });
      expect(await listWishlist(a)).toEqual([]);
    });
    it("a full wishlist says so", async () => {
      const a = await mkUser(); const p = await mk();
      await WishlistItem.insertMany(Array.from({ length: WISHLIST_MAX }, () => ({ user: a, product: new mongoose.Types.ObjectId() })));
      const e = await fails(addToWishlist(a, p.id), "CONFLICT");
      expect(e.message).toMatch(/full/);
    });
    it("cards by slug keep the order asked for and drop unknown and hidden products", async () => {
      const [p1, p2, p3] = [await mk(), await mk(), await mk({ status: "draft" })];
      const cards = await findCards({ slugs: [p2.slug, "unknown-slug", p3.slug, p1.slug, "BAD SLUG!"] });
      expect(cards.map((c) => c.slug)).toEqual([p2.slug, p1.slug]);
      expect(await findCards({ slugs: [] })).toEqual([]);
    });
    it("the public cards route validates input and returns cards", async () => {
      const p = await mk();
      const call = (body: unknown) => cardsPOST(new Request("http://x/api/products/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      const ok = await call({ slugs: [p.slug] });
      expect(ok.status).toBe(200);
      expect((await ok.json()).data.map((c: { slug: string }) => c.slug)).toEqual([p.slug]);
      expect((await call({ slugs: Array.from({ length: 13 }, (_, i) => `s-${i}`) })).status).toBe(400);
      expect((await call({ slugs: "x" })).status).toBe(400);
    });
  });

  it("related products and cards carry ratings too", async () => {
    const p = await mk(); const q = await mk({ isFeatured: true }); // featured products top up the related list
    const uid = await mkUser(); await buy(uid, q.id);
    const r = await saveMyReview(uid, "Asha Rao", q.slug, review(4));
    await moderateReview(r.review.id, "published", undefined, "Mod");
    expect((await findRelated(p.slug)).find((x) => x.id === q.id)?.rating).toEqual({ avg: 4, count: 1 });
  });
});
