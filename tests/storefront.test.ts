import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { Category } from "@/server/models/Category";
import { Product } from "@/server/models/Product";
import { createCategory, findPublicCategory, updateCategory } from "@/server/services/categories";
import { createProduct, findPublicProduct, findRelated } from "@/server/services/products";
import { listingHref, parseListing } from "@/lib/listing";
import { emptyCategory, type ProductInput } from "@/lib/validation/catalog";
import { emptySeo } from "@/lib/validation/pages";

const cat = (name: string, slug: string, over = {}) => ({ ...emptyCategory, name, slug, ...over });
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "P", slug: "p", sku: "P1", shortDescription: "", description: "", images: [], category: null, brand: "", price: 10000, salePrice: null, stock: 5, lowStockThreshold: 5,
  status: "active", isFeatured: false, attributes: [], variants: [], shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});

describe("listing query parsing", () => {
  it("converts rupees to paise and ignores bad values instead of failing", () => {
    const q = parseListing({ sort: "price-asc", min: "100", max: "500", page: "2", q: "diya" });
    expect(q).toMatchObject({ sort: "price-asc", minPrice: 10000, maxPrice: 50000, page: 2, q: "diya" });
    const bad = parseListing({ sort: "weird", min: "-5", max: "abc", page: "0", q: "a" });
    expect(bad).toMatchObject({ sort: "newest", page: 1 });
    expect(bad.minPrice).toBeUndefined();
    expect(bad.maxPrice).toBeUndefined();
    expect(bad.q).toBeUndefined();
  });
  it("forced fields win over the URL (category pages cannot be re-scoped by a query string)", () => {
    const q = parseListing({ q: "brass", sort: ["a", "b"] }, { category: "kits", q: undefined });
    expect(q.category).toBe("kits");
    expect(q.q).toBeUndefined();
    expect(q.sort).toBe("newest");
  });
  it("builds links that keep filters and omit defaults", () => {
    const q = parseListing({ sort: "popular", min: "10", page: "3" });
    expect(listingHref("/search", q, { page: 4 })).toBe("/search?sort=popular&min=10&page=4");
    expect(listingHref("/c", parseListing({}))).toBe("/c");
    expect(listingHref("/c", q, { page: 1 })).toBe("/c?sort=popular&min=10");
  });
});

describe("storefront reads (godpuja_test)", () => {
  const wipe = () => Promise.all([Category.deleteMany({}), Product.deleteMany({})]);
  beforeAll(async () => { await connectDB(); if (mongoose.connection.name !== "godpuja_test") throw new Error("wrong db"); await Promise.all([Category.syncIndexes(), Product.syncIndexes()]); });
  beforeEach(wipe);
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });

  it("category page: breadcrumbs, active children only, hidden when it or any ancestor is inactive", async () => {
    const a = await createCategory(cat("Kits", "kits"));
    const b = await createCategory(cat("Diwali", "diwali", { parent: a.id, order: 1 }));
    const c = await createCategory(cat("Small", "small", { parent: b.id }));
    await createCategory(cat("Hidden kid", "hidden-kid", { parent: b.id, isActive: false }));
    const page = (await findPublicCategory("kits/diwali"))!;
    expect(page.breadcrumbs.map((x) => x.name)).toEqual(["Kits", "Diwali"]);
    expect(page.children.map((x) => x.path)).toEqual(["kits/diwali/small"]);
    expect(await findPublicCategory("kits/missing")).toBeNull();
    expect(await findPublicCategory("nope")).toBeNull();
    await updateCategory(a.id, { ...cat("Kits", "kits", { isActive: false }), baseUpdatedAt: a.updatedAt });
    expect(await findPublicCategory("kits")).toBeNull();
    expect(await findPublicCategory("kits/diwali")).toBeNull(); // hidden through its ancestor
    expect(await findPublicCategory("kits/diwali/small")).toBeNull();
    void c;
  });

  it("product detail carries category breadcrumbs with real names", async () => {
    const a = await createCategory(cat("Puja Kits", "puja-kits"));
    const b = await createCategory(cat("Diwali Specials", "diwali", { parent: a.id }));
    await createProduct(prod({ category: b.id }));
    const d = (await findPublicProduct("p"))!;
    expect(d.breadcrumbs).toEqual([{ name: "Puja Kits", path: "puja-kits" }, { name: "Diwali Specials", path: "puja-kits/diwali" }]);
  });

  it("related products: same category first (best sellers), topped up with featured, never itself/draft/hidden", async () => {
    const a = await createCategory(cat("A", "a"));
    const other = await createCategory(cat("Other", "other"));
    const secret = await createCategory(cat("Secret", "secret"));
    await createProduct(prod({ name: "Main", slug: "main", sku: "M", category: a.id }));
    await createProduct(prod({ name: "Sib1", slug: "sib1", sku: "S1", category: a.id }));
    await createProduct(prod({ name: "Sib2", slug: "sib2", sku: "S2", category: a.id }));
    await createProduct(prod({ name: "Draft", slug: "draft", sku: "D", category: a.id, status: "draft" }));
    await createProduct(prod({ name: "Feat", slug: "feat", sku: "F", category: other.id, isFeatured: true }));
    await createProduct(prod({ name: "FeatHidden", slug: "feat-hidden", sku: "FH", category: secret.id, isFeatured: true }));
    await Product.updateOne({ slug: "sib2" }, { $set: { soldCount: 9 } });
    await updateCategory(secret.id, { ...cat("Secret", "secret", { isActive: false }), baseUpdatedAt: secret.updatedAt });
    const rel = await findRelated("main", 4);
    expect(rel.map((p) => p.slug)).toEqual(["sib2", "sib1", "feat"]); // sold first, then featured top-up; no draft/self/hidden
    expect(await findRelated("draft")).toEqual([]);
    expect(await findRelated("missing")).toEqual([]);
  });
});
