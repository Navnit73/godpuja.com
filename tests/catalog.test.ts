import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { Category } from "@/server/models/Category";
import { Product } from "@/server/models/Product";
import { Redirect } from "@/server/models/Redirect";
import { createCategory, deleteCategory, findCategoryTree, getCategory, listCategories, updateCategory } from "@/server/services/categories";
import { adjustStock, createProduct, deleteProduct, findPublicProduct, findPublicProducts, getProduct, listProducts, updateProduct } from "@/server/services/products";
import { ApiError } from "@/server/api";
import { can } from "@/server/auth/permissions";
import { categoryInputSchema, emptyCategory, inventorySchema, productInputSchema, publicProductsSchema, updateProductSchema, type CategoryInput, type ProductInput } from "@/lib/validation/catalog";
import { emptySeo } from "@/lib/validation/pages";

const cat = (over: Partial<CategoryInput> = {}): CategoryInput => ({ ...emptyCategory, name: "Cat", slug: "cat", ...over });
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Diya", slug: "diya", sku: "DIYA-1", shortDescription: "", description: "", images: [], category: null, brand: "", price: 10000, salePrice: null,
  stock: 10, lowStockThreshold: 5, status: "draft", isFeatured: false, attributes: [], variants: [],
  shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
};

describe("catalog validation", () => {
  it("categories: slug, image alt, ids", () => {
    expect(categoryInputSchema.safeParse(cat()).success).toBe(true);
    for (const slug of ["Bad Slug", "a/b", "-x", "x--y", ""]) expect(categoryInputSchema.safeParse(cat({ slug })).success).toBe(false);
    expect(categoryInputSchema.safeParse(cat({ image: { url: "https://x.com/a.png", alt: "" } })).success).toBe(false);
    expect(categoryInputSchema.safeParse(cat({ image: { url: "javascript:1", alt: "a" } })).success).toBe(false);
    expect(categoryInputSchema.safeParse(cat({ parent: "nope" })).success).toBe(false);
  });
  it("products: price rules, sku uniqueness, activation rules, URLs, limits", () => {
    expect(productInputSchema.safeParse(prod()).success).toBe(true);
    expect(productInputSchema.safeParse(prod({ price: 99.5 })).success).toBe(false);
    expect(productInputSchema.safeParse(prod({ price: -1 })).success).toBe(false);
    expect(productInputSchema.safeParse(prod({ salePrice: 10000 })).success).toBe(false);
    expect(productInputSchema.safeParse(prod({ salePrice: 9000 })).success).toBe(true);
    expect(productInputSchema.safeParse(prod({ status: "active" })).success).toBe(false); // no category
    expect(productInputSchema.safeParse(prod({ status: "active", category: "a".repeat(24) })).success).toBe(true);
    expect(productInputSchema.safeParse(prod({ status: "active", category: "a".repeat(24), price: 0 })).success).toBe(false);
    const v = (sku: string) => ({ sku, options: { Size: "S" }, stock: 1 });
    expect(productInputSchema.safeParse(prod({ variants: [v("A"), v("a")] })).success).toBe(false);
    expect(productInputSchema.safeParse(prod({ variants: [v("DIYA-1")] })).success).toBe(false); // clashes with product sku
    expect(productInputSchema.safeParse(prod({ variants: [{ ...v("B"), options: {} }] })).success).toBe(false);
    expect(productInputSchema.safeParse(prod({ images: [{ url: "javascript:1", alt: "x" }] })).success).toBe(false);
    expect(productInputSchema.safeParse(prod({ images: [{ url: "https://x.com/a.png", alt: "" }] })).success).toBe(false);
    expect(productInputSchema.safeParse(prod({ images: Array.from({ length: 11 }, () => ({ url: "https://x.com/a.png", alt: "a" })) })).success).toBe(false);
    expect(productInputSchema.parse(prod({ sku: " diya-2 " })).sku).toBe("DIYA-2");
  });
  it("update schema requires baseUpdatedAt; inventory schema forbids zero delta / negatives", () => {
    expect(updateProductSchema.safeParse(prod()).success).toBe(false);
    expect(inventorySchema.safeParse({ delta: 0 }).success).toBe(false);
    expect(inventorySchema.safeParse({ delta: -3 }).success).toBe(true);
    expect(inventorySchema.safeParse({ set: -1 }).success).toBe(false);
    expect(inventorySchema.safeParse({ set: 4.5 }).success).toBe(false);
  });
  it("public query is bounded and sanitised", () => {
    expect(publicProductsSchema.safeParse({ limit: "999" }).success).toBe(false);
    expect(publicProductsSchema.safeParse({ category: "../etc" }).success).toBe(false);
    expect(publicProductsSchema.safeParse({ category: "puja-kits/diwali" }).success).toBe(true);
    expect(publicProductsSchema.safeParse({ sort: "weird" }).success).toBe(false);
    expect(publicProductsSchema.safeParse({ q: "a" }).success).toBe(false);
  });
});

describe("catalog (godpuja_test)", () => {
  const wipe = () => Promise.all([Category.deleteMany({}), Product.deleteMany({}), Redirect.deleteMany({})]);
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Category.syncIndexes(), Product.syncIndexes(), Redirect.syncIndexes()]);
  });
  beforeEach(wipe);
  afterAll(async () => { await wipe(); }); // connection is closed by the last DB describe in this file

  it("builds nested paths, enforces depth 3 and unique sibling slugs", async () => {
    const a = await createCategory(cat({ name: "Kits", slug: "kits" }));
    const b = await createCategory(cat({ name: "Diwali", slug: "diwali", parent: a.id }));
    const c = await createCategory(cat({ name: "Small", slug: "small", parent: b.id }));
    expect([a.path, b.path, c.path]).toEqual(["kits", "kits/diwali", "kits/diwali/small"]);
    expect([a.level, b.level, c.level]).toEqual([1, 2, 3]);
    await fails(createCategory(cat({ slug: "tiny", parent: c.id })), "VALIDATION_ERROR");
    await fails(createCategory(cat({ slug: "kits" })), "CONFLICT");
    await createCategory(cat({ slug: "diwali" })); // same slug under another parent is fine
    await fails(createCategory(cat({ slug: "x", parent: new mongoose.Types.ObjectId().toHexString() })), "VALIDATION_ERROR");
  });

  it("renaming/moving recomputes the whole subtree and writes 301s, without chains", async () => {
    const a = await createCategory(cat({ name: "Kits", slug: "kits" }));
    const b = await createCategory(cat({ name: "Diwali", slug: "diwali", parent: a.id }));
    const c = await createCategory(cat({ name: "Small", slug: "small", parent: b.id }));
    const root2 = await createCategory(cat({ name: "Idols", slug: "idols" }));
    // rename root
    const a2 = await updateCategory(a.id, { ...cat({ name: "Kits", slug: "puja-kits" }), baseUpdatedAt: a.updatedAt });
    expect(a2.path).toBe("puja-kits");
    expect((await getCategory(b.id)).path).toBe("puja-kits/diwali");
    expect((await getCategory(c.id)).path).toBe("puja-kits/diwali/small");
    let reds = Object.fromEntries((await Redirect.find().lean()).map((r) => [r.from, r.to]));
    expect(reds).toMatchObject({ "/category/kits": "/category/puja-kits", "/category/kits/diwali/small": "/category/puja-kits/diwali/small" });
    // move diwali (with child) under idols => level shifts, older redirects re-pointed (no chains)
    const bNow = await getCategory(b.id);
    await updateCategory(b.id, { ...cat({ name: "Diwali", slug: "diwali", parent: root2.id }), baseUpdatedAt: bNow.updatedAt });
    expect((await getCategory(c.id)).path).toBe("idols/diwali/small");
    expect((await getCategory(c.id)).level).toBe(3);
    reds = Object.fromEntries((await Redirect.find().lean()).map((r) => [r.from, r.to]));
    expect(reds["/category/kits/diwali"]).toBe("/category/idols/diwali");
    expect(reds["/category/puja-kits/diwali"]).toBe("/category/idols/diwali");
    expect(Object.values(reds).every((to) => !(to in reds))).toBe(true); // no chains
  });

  it("rejects cycles, too-deep moves, self-parent and stale edits; rolls back on conflict", async () => {
    const a = await createCategory(cat({ slug: "a", name: "A" }));
    const b = await createCategory(cat({ slug: "b", name: "B", parent: a.id }));
    const c = await createCategory(cat({ slug: "c", name: "C", parent: b.id }));
    const x = await createCategory(cat({ slug: "x", name: "X" }));
    await createCategory(cat({ slug: "y", name: "Y", parent: x.id }));
    await fails(updateCategory(a.id, { ...cat({ slug: "a", name: "A", parent: c.id }), baseUpdatedAt: a.updatedAt }), "VALIDATION_ERROR"); // under own descendant
    await fails(updateCategory(a.id, { ...cat({ slug: "a", name: "A", parent: a.id }), baseUpdatedAt: a.updatedAt }), "VALIDATION_ERROR");
    await fails(updateCategory(x.id, { ...cat({ slug: "x", name: "X", parent: b.id }), baseUpdatedAt: x.updatedAt }), "VALIDATION_ERROR"); // x(+y)=2 levels under level-2 => 4
    await fails(updateCategory(c.id, { ...cat({ slug: "c", name: "C", parent: b.id }), baseUpdatedAt: new Date(0).toISOString() }), "CONFLICT");
    // slug collision rolls back the whole move
    await fails(updateCategory(b.id, { ...cat({ slug: "x", name: "B", parent: null }), baseUpdatedAt: b.updatedAt }), "CONFLICT");
    expect((await getCategory(b.id)).path).toBe("a/b");
    expect((await getCategory(c.id)).path).toBe("a/b/c");
    expect(await Redirect.countDocuments()).toBe(0);
  });

  it("delete is blocked while it has children or products", async () => {
    const a = await createCategory(cat({ slug: "a", name: "A" }));
    const b = await createCategory(cat({ slug: "b", name: "B", parent: a.id }));
    await fails(deleteCategory(a.id), "CONFLICT");
    await createProduct(prod({ category: b.id }));
    await fails(deleteCategory(b.id), "CONFLICT");
    expect((await listCategories()).find((c) => c.id === b.id)?.productCount).toBe(1);
  });

  it("public tree hides inactive categories with their subtree", async () => {
    const a = await createCategory(cat({ slug: "a", name: "A" }));
    const b = await createCategory(cat({ slug: "b", name: "B", parent: a.id }));
    await createCategory(cat({ slug: "c", name: "C", parent: b.id }));
    await createCategory(cat({ slug: "z", name: "Z" }));
    await updateCategory(b.id, { ...cat({ slug: "b", name: "B", parent: a.id, isActive: false }), baseUpdatedAt: b.updatedAt });
    const tree = await findCategoryTree();
    expect(tree.map((t) => t.slug)).toEqual(["a", "z"]);
    expect(tree[0].children).toEqual([]);
  });

  it("products: unique slug/sku (incl. variant skus), edit keeps stock, slug change writes a 301", async () => {
    const p = await createProduct(prod({ variants: [{ sku: "V1", options: { Size: "S" }, stock: 3 }, { sku: "V2", options: { Size: "L" }, stock: 4 }] }));
    await fails(createProduct(prod({ slug: "other" })), "CONFLICT"); // same sku
    await fails(createProduct(prod({ slug: "diya", sku: "NEW" })), "CONFLICT"); // same slug
    await fails(createProduct(prod({ slug: "o2", sku: "O2", variants: [{ sku: "V1", options: { Size: "S" }, stock: 1 }] })), "CONFLICT"); // variant sku clash
    await adjustStock(p.id, { sku: "V1", delta: -2 });
    const edited = await updateProduct(p.id, { ...prod({ slug: "diya-lamp", name: "Diya lamp", variants: [{ sku: "V1", options: { Size: "S" }, stock: 999 }, { sku: "V3", options: { Size: "M" }, stock: 7 }] }), baseUpdatedAt: p.updatedAt });
    expect(edited.previousSlug).toBe("diya");
    expect(Object.fromEntries(edited.product.variants.map((v) => [v.sku, v.stock]))).toEqual({ V1: 1, V3: 7 }); // V1 kept real stock, V3 new
    expect((await Redirect.findOne({ from: "/product/diya" }).lean())?.to).toBe("/product/diya-lamp");
    await fails(updateProduct(p.id, { ...prod(), baseUpdatedAt: p.updatedAt }), "CONFLICT");
  });

  it("stock changes do not make the editor's version stale", async () => {
    const p = await createProduct(prod());
    await adjustStock(p.id, { delta: -1 });
    await updateProduct(p.id, { ...prod({ name: "Renamed" }), baseUpdatedAt: p.updatedAt }); // would 409 if stock bumped updatedAt
    expect((await getProduct(p.id)).stock).toBe(9);
  });

  it("inventory is atomic: concurrent decrements never oversell", async () => {
    const p = await createProduct(prod({ stock: 10 }));
    const r = await Promise.allSettled(Array.from({ length: 25 }, () => adjustStock(p.id, { delta: -1 })));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(10);
    expect(r.filter((x) => x.status === "rejected").every((x) => ((x as PromiseRejectedResult).reason as ApiError).code === "CONFLICT")).toBe(true);
    expect((await getProduct(p.id)).stock).toBe(0);
  });

  it("inventory on variants: per-SKU guard, set, unknown sku, sku required", async () => {
    const p = await createProduct(prod({ variants: [{ sku: "V1", options: { S: "1" }, stock: 2 }, { sku: "V2", options: { S: "2" }, stock: 5 }] }));
    await fails(adjustStock(p.id, { delta: 1 }), "VALIDATION_ERROR");
    await fails(adjustStock(p.id, { sku: "NOPE", delta: 1 }), "NOT_FOUND");
    await fails(adjustStock(p.id, { sku: "V1", delta: -3 }), "CONFLICT");
    expect((await adjustStock(p.id, { sku: "V1", delta: -2 })).variants.find((v) => v.sku === "V1")?.stock).toBe(0);
    expect((await adjustStock(p.id, { sku: "V2", set: 9 })).stock).toBe(9);
    const rr = await Promise.allSettled(Array.from({ length: 10 }, () => adjustStock(p.id, { sku: "V2", delta: -1 })));
    expect(rr.filter((x) => x.status === "fulfilled")).toHaveLength(9);
    await fails(adjustStock("a".repeat(24), { delta: 1 }), "NOT_FOUND");
  });

  it("admin list: filters, low stock, pagination", async () => {
    const c = await createCategory(cat({ slug: "k", name: "K" }));
    await createProduct(prod({ name: "Alpha", slug: "alpha", sku: "A", stock: 2, category: c.id }));
    await createProduct(prod({ name: "Beta", slug: "beta", sku: "B", stock: 50 }));
    await createProduct(prod({ name: "Gamma", slug: "gamma", sku: "G", status: "archived", variants: [{ sku: "G1", options: { a: "b" }, stock: 1 }] }));
    const q = (o = {}) => listProducts({ page: 1, limit: 20, ...o });
    expect((await q()).total).toBe(3);
    expect((await q({ q: "alp" })).items.map((i) => i.slug)).toEqual(["alpha"]);
    expect((await q({ q: "g1" })).items.map((i) => i.slug)).toEqual(["gamma"]); // variant sku search
    expect((await q({ status: "archived" })).total).toBe(1);
    expect((await q({ category: c.id })).total).toBe(1);
    expect((await q({ lowStock: "1" })).items.map((i) => i.slug).sort()).toEqual(["alpha", "gamma"]);
    expect((await q({ limit: 2 })).pages).toBe(2);
  });

  it("public products: only active, filters/sort/search/paging, no stock numbers leaked", async () => {
    const a = await createCategory(cat({ slug: "kits", name: "Kits" }));
    const b = await createCategory(cat({ slug: "diwali", name: "Diwali", parent: a.id }));
    const act = (o: Partial<ProductInput>) => prod({ status: "active", ...o });
    await createProduct(act({ name: "Brass diya", slug: "brass-diya", sku: "P1", category: b.id, price: 50000, salePrice: 40000, isFeatured: true }));
    await createProduct(act({ name: "Clay lamp", slug: "clay-lamp", sku: "P2", category: a.id, price: 20000, stock: 0 }));
    await createProduct(prod({ name: "Draft thing", slug: "draft-thing", sku: "P3", category: a.id }));
    await createProduct(act({ name: "Other", slug: "other", sku: "P4", price: 90000, category: null }));
    await Product.updateOne({ slug: "clay-lamp" }, { $set: { soldCount: 99 } });
    const list = (o = {}) => findPublicProducts(publicProductsSchema.parse(o));
    expect((await list()).items.map((i) => i.slug).sort()).toEqual(["brass-diya", "clay-lamp", "other"]);
    expect((await list({ category: "kits" })).items.map((i) => i.slug).sort()).toEqual(["brass-diya", "clay-lamp"]); // includes descendants
    expect((await list({ category: "kits/diwali" })).items.map((i) => i.slug)).toEqual(["brass-diya"]);
    expect((await list({ category: "nope" })).total).toBe(0);
    expect((await list({ sort: "price-asc" })).items.map((i) => i.slug)).toEqual(["clay-lamp", "brass-diya", "other"]); // sale price counts
    expect((await list({ sort: "popular" })).items[0].slug).toBe("clay-lamp");
    expect((await list({ minPrice: 30000, maxPrice: 45000 })).items.map((i) => i.slug)).toEqual(["brass-diya"]);
    expect((await list({ featured: "1" })).total).toBe(1);
    expect((await list({ q: "brass" })).items.map((i) => i.slug)).toEqual(["brass-diya"]);
    expect((await list({ limit: 2 })).items).toHaveLength(2);
    const item = (await list({ category: "kits/diwali" })).items[0] as Record<string, unknown>;
    expect(item).not.toHaveProperty("stock");
    expect((await list()).items.find((i) => i.slug === "clay-lamp")?.inStock).toBe(false);
    // inactive category hides its products
    await updateCategory(a.id, { ...cat({ slug: "kits", name: "Kits", isActive: false }), baseUpdatedAt: (await getCategory(a.id)).updatedAt });
    expect((await list({ category: "kits/diwali" })).total).toBe(0);
  });

  it("public detail: active only, sanitised description, hides stock and sku internals of drafts", async () => {
    await createProduct(prod({ status: "active", category: (await createCategory(cat({ slug: "c", name: "C" }))).id, description: "**bold**\n\n<script>alert(1)</script>", variants: [{ sku: "V1", options: { S: "1" }, stock: 3 }] }));
    await createProduct(prod({ name: "Hidden", slug: "hidden", sku: "H" }));
    const d = (await findPublicProduct("diya"))!;
    expect(d.descriptionHtml).toContain("<strong>bold</strong>");
    expect(d.descriptionHtml).not.toContain("<script");
    expect(d.variants[0]).toMatchObject({ sku: "V1", inStock: true });
    expect(JSON.stringify(d)).not.toMatch(/"stock"/);
    expect(await findPublicProduct("hidden")).toBeNull();
    expect(await findPublicProduct("missing")).toBeNull();
    await deleteProduct((await Product.findOne({ slug: "diya" }).lean())!._id.toString());
    expect(await findPublicProduct("diya")).toBeNull();
  });

  it("storefront queries use indexes (no collection scans)", async () => {
    const cats = await createCategory(cat({ slug: "k", name: "K" }));
    await createProduct(prod({ status: "active", category: cats.id }));
    const stages = (plan: unknown): string[] => { const s: string[] = []; const walk = (n: unknown) => { if (n && typeof n === "object") { const o = n as Record<string, unknown>; if (typeof o.stage === "string") s.push(o.stage); Object.values(o).forEach(walk); } }; walk(plan); return s; };
    const ex = async (q: mongoose.Query<unknown[], unknown>) => stages(((await q.explain("queryPlanner")) as unknown as { queryPlanner: { winningPlan: unknown } }).queryPlanner.winningPlan);
    const checks: Record<string, mongoose.Query<unknown[], unknown>> = {
      "category listing": Product.find({ status: "active", category: { $in: [new mongoose.Types.ObjectId()] } }).sort({ createdAt: -1, _id: -1 }),
      "featured": Product.find({ status: "active", isFeatured: true }),
      "price sort": Product.find({ status: "active" }).sort({ effectivePrice: 1, _id: 1 }),
      "popular": Product.find({ status: "active" }).sort({ soldCount: -1, _id: -1 }),
      "price range": Product.find({ status: "active", effectivePrice: { $gte: 1, $lte: 5 } }),
      "slug": Product.find({ slug: "x", status: "active" }),
      "text search": Product.find({ status: "active", $text: { $search: "brass" } }),
      "category by path": Category.find({ path: "kits" }) as never,
    };
    for (const [name, q] of Object.entries(checks)) {
      const st = await ex(q);
      expect(st.some((x) => /IXSCAN|TEXT_MATCH/.test(x)), `${name}: ${st.join(">")}`).toBe(true);
      expect(st, name).not.toContain("COLLSCAN");
    }
  });
});

describe("catalog audit regressions (godpuja_test)", () => {
  const wipe = () => Promise.all([Category.deleteMany({}), Product.deleteMany({}), Redirect.deleteMany({})]);
  beforeAll(async () => { await connectDB(); if (mongoose.connection.name !== "godpuja_test") throw new Error("wrong db"); await Promise.all([Category.syncIndexes(), Product.syncIndexes(), Redirect.syncIndexes()]); });
  beforeEach(wipe);
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });
  const list = (o = {}) => findPublicProducts(publicProductsSchema.parse(o));

  it("a sale price can be cleared on update (and effective price follows)", async () => {
    const p = await createProduct(prod({ salePrice: 8000 }));
    const cleared = await updateProduct(p.id, { ...prod({ salePrice: null }), baseUpdatedAt: p.updatedAt });
    expect(cleared.product.salePrice).toBeNull();
    expect((await getProduct(p.id)).salePrice).toBeNull();
    expect((await Product.findById(p.id).lean())!.effectivePrice).toBe(10000);
  });

  it("hiding a category hides its products everywhere: list, search, featured, detail, rails", async () => {
    const hidden = await createCategory(cat({ name: "Secret", slug: "secret" }));
    const kid = await createCategory(cat({ name: "Kid", slug: "kid", parent: hidden.id }));
    const open = await createCategory(cat({ name: "Open", slug: "open" }));
    const act = (o: Partial<ProductInput>) => prod({ status: "active", isFeatured: true, ...o });
    await createProduct(act({ name: "Brass lamp", slug: "in-secret", sku: "S1", category: hidden.id }));
    await createProduct(act({ name: "Brass bell", slug: "in-kid", sku: "S2", category: kid.id }));
    await createProduct(act({ name: "Brass tray", slug: "in-open", sku: "S3", category: open.id }));
    expect((await list()).total).toBe(3);
    await updateCategory(hidden.id, { ...cat({ name: "Secret", slug: "secret", isActive: false }), baseUpdatedAt: hidden.updatedAt });
    expect((await list()).items.map((i) => i.slug)).toEqual(["in-open"]);
    expect((await list({ q: "brass" })).items.map((i) => i.slug)).toEqual(["in-open"]);
    expect((await list({ featured: "1" })).items.map((i) => i.slug)).toEqual(["in-open"]);
    expect(await findPublicProduct("in-secret")).toBeNull();
    expect(await findPublicProduct("in-kid")).toBeNull(); // hidden through its parent
    expect((await findPublicProduct("in-open"))?.slug).toBe("in-open");
    const { findRail, loadCategoryIndex } = await import("@/server/services/products");
    const idx = await loadCategoryIndex();
    expect((await findRail({ kind: "latestProducts", category: "", limit: 10 }, idx.catPath, idx.hidden)).map((p) => p.slug)).toEqual(["in-open"]);
  });

  it("variant option names that Mongo cannot store are a 400-class validation error, not a crash", () => {
    const v = (k: string) => ({ sku: "V9", options: { [k]: "x" }, stock: 1 });
    for (const k of ["a.b", "$x", "__proto__", "constructor"]) expect(productInputSchema.safeParse(prod({ variants: [v(k)] })).success, k).toBe(false);
    expect(productInputSchema.safeParse(prod({ variants: [v("Size")] })).success).toBe(true);
  });

  it("variant sale price must be below the price it would sell at (own price or the product's)", () => {
    const v = (over: object) => ({ sku: "V9", options: { Size: "L" }, stock: 1, ...over });
    expect(productInputSchema.safeParse(prod({ price: 10000, variants: [v({ salePrice: 99999 })] })).success).toBe(false); // no own price
    expect(productInputSchema.safeParse(prod({ price: 10000, variants: [v({ price: 200000, salePrice: 150000 })] })).success).toBe(true);
    expect(productInputSchema.safeParse(prod({ price: 10000, variants: [v({ salePrice: 9000 })] })).success).toBe(true);
  });

  it("SKUs are one namespace across products and variants", async () => {
    await createProduct(prod({ sku: "AAA", slug: "a", variants: [{ sku: "A-V1", options: { S: "1" }, stock: 1 }] }));
    await fails(createProduct(prod({ sku: "A-V1", slug: "b" })), "CONFLICT"); // product sku == other's variant sku
    await fails(createProduct(prod({ sku: "BBB", slug: "c", variants: [{ sku: "AAA", options: { S: "1" }, stock: 1 }] })), "CONFLICT"); // variant sku == other's product sku
    await createProduct(prod({ sku: "BBB", slug: "d" }));
  });

  it("stock can neither go below zero nor above the cap", async () => {
    const p = await createProduct(prod({ stock: 9_999_999 }));
    await fails(adjustStock(p.id, { delta: 2 }), "CONFLICT");
    expect((await adjustStock(p.id, { delta: 1 })).stock).toBe(10_000_000);
    await fails(adjustStock(p.id, { delta: 1 }), "CONFLICT");
    expect((await adjustStock(p.id, { delta: -1 })).slug).toBe("diya"); // result carries the slug for cache invalidation
  });

  it("creating a URL that has an old redirect removes that redirect; deleting removes redirects that led to it", async () => {
    const p = await createProduct(prod());
    await updateProduct(p.id, { ...prod({ slug: "diya-new" }), baseUpdatedAt: p.updatedAt });
    expect(await Redirect.countDocuments({ from: "/product/diya" })).toBe(1);
    await createProduct(prod({ slug: "diya", sku: "OTHER" })); // the old URL is a real product again
    expect(await Redirect.countDocuments({ from: "/product/diya" })).toBe(0);
    await deleteProduct(p.id);
    expect(await Redirect.countDocuments({ to: "/product/diya-new" })).toBe(0);
    // same for categories
    const c = await createCategory(cat({ slug: "old" }));
    await updateCategory(c.id, { ...cat({ slug: "new" }), baseUpdatedAt: c.updatedAt });
    await createCategory(cat({ slug: "old" }));
    expect(await Redirect.countDocuments({ from: "/category/old" })).toBe(0);
    await deleteCategory((await Category.findOne({ path: "new" }).lean())!._id.toString());
    expect(await Redirect.countDocuments({ to: "/category/new" })).toBe(0);
  });

  it("concurrent opposite moves never create a cycle", async () => {
    for (let round = 0; round < 4; round++) {
      await Category.deleteMany({});
      const a = await createCategory(cat({ name: "A", slug: "a" }));
      const b = await createCategory(cat({ name: "B", slug: "b" }));
      await Promise.allSettled([
        updateCategory(a.id, { ...cat({ name: "A", slug: "a", parent: b.id }), baseUpdatedAt: a.updatedAt }),
        updateCategory(b.id, { ...cat({ name: "B", slug: "b", parent: a.id }), baseUpdatedAt: b.updatedAt }),
      ]);
      const rows = await Category.find().lean();
      const roots = rows.filter((r) => !r.parent);
      expect(roots.length, `round ${round}: someone must remain a root`).toBeGreaterThanOrEqual(1);
      for (const r of rows) expect(r.path.split("/").length).toBe(r.level); // paths and levels stay consistent
    }
  });

  it("creating under a parent that is being deleted/moved cannot orphan the child", async () => {
    const parent = await createCategory(cat({ name: "P", slug: "p" }));
    const r = await Promise.allSettled([createCategory(cat({ name: "K", slug: "k", parent: parent.id })), deleteCategory(parent.id)]);
    const kids = await Category.countDocuments({ parent: parent.id });
    const parentExists = await Category.exists({ _id: parent.id });
    expect(!(kids > 0 && !parentExists), JSON.stringify(r.map((x) => x.status))).toBe(true); // never a child without its parent
  });
});

describe("request body limits", () => {
  it("readLimited stops chunked bodies that exceed the limit (no Content-Length)", async () => {
    const { readLimited } = await import("@/server/api");
    const big = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < 10; i++) c.enqueue(new Uint8Array(1000)); c.close(); } });
    const req = new Request("http://x/", { method: "POST", body: big, duplex: "half" } as RequestInit);
    await expect(readLimited(req, 5000)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const ok = new Request("http://x/", { method: "POST", body: new Uint8Array(100) });
    expect((await readLimited(ok, 5000)).byteLength).toBe(100);
  });
});

describe("catalog permissions", () => {
  it("matrix", () => {
    expect(can("content_manager", "products:write")).toBe(false);
    expect(can("store_manager", "products:write")).toBe(true);
    expect(can("store_manager", "inventory:write")).toBe(true);
    expect(can("store_manager", "categories:write")).toBe(true); // PRD v1.1 §12: store manager owns categories
    expect(can("admin", "categories:write")).toBe(true);
    expect(can("content_manager", "media:write")).toBe(true);
    expect(can("customer", "products:read")).toBe(false);
  });
});
