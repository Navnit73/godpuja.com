// Advanced search: type-ahead suggestions across products, categories, guides, aarti/mantras and posts; partial-word product search.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { Category } from "@/server/models/Category";
import { Devotional } from "@/server/models/Devotional";
import { Page } from "@/server/models/Page";
import { Product } from "@/server/models/Product";
import { Vidhi } from "@/server/models/Vidhi";
import { createCategory } from "@/server/services/categories";
import { createDevotional, setDevotionalPublishState } from "@/server/services/devotional";
import { createPage, setPublishState } from "@/server/services/pages";
import { createProduct, findFacets, findPublicProducts } from "@/server/services/products";
import { cleanQuery, contentCounts, suggestAll } from "@/server/services/search";
import { createVidhi, setVidhiPublishState } from "@/server/services/vidhi";
import { emptyCategory, publicProductsSchema, type ProductInput } from "@/lib/validation/catalog";
import { devotionalInputSchema, emptyDevotional } from "@/lib/validation/devotional";
import { emptySeo, pageInputSchema } from "@/lib/validation/pages";
import { emptyVidhi, vidhiInputSchema } from "@/lib/validation/vidhi";

const REVIEWED = { reviewer: "Pt. Sharma", reviewedAt: "2026-11-01T00:00:00+05:30" };
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Brass diya", slug: "brass-diya", sku: "DIYA-1", shortDescription: "", description: "", images: [{ url: "https://example.com/a.jpg", alt: "Diya" }], category: null, brand: "", price: 10000, salePrice: null,
  stock: 50, lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [], shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const list = (o: object, partial = false) => findPublicProducts(publicProductsSchema.parse(o), { partial });

describe("search", () => {
  const wipe = () => Promise.all([Category, Product, Vidhi, Devotional, Page].map((m) => (m as typeof Product).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Category, Product, Vidhi, Devotional, Page].map((m) => (m as typeof Product).syncIndexes()));
  });
  beforeEach(wipe);
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });

  it("cleans the query: collapses spaces, caps length, and treats one character as nothing", async () => {
    expect(cleanQuery("  brass   diya ")).toBe("brass diya");
    expect(cleanQuery("x".repeat(200))).toHaveLength(60);
    expect((await suggestAll("a")).total).toBe(0);
    expect((await suggestAll("   ")).total).toBe(0);
  });

  it("suggests products by the start of any word in the name, brand, or SKU, and needs every word to match", async () => {
    await createProduct(prod({ name: "Brass Ganesha Idol", slug: "brass-ganesha", sku: "GN-100", brand: "Shilpkar", price: 150000, salePrice: 120000 }));
    await createProduct(prod({ name: "Clay Diya Set", slug: "clay-diya", sku: "CD-1" }));
    await createProduct(prod({ name: "Draft thing", slug: "draft-thing", sku: "DR-1", status: "draft" }));
    expect((await suggestAll("gane")).products.map((p) => p.slug)).toEqual(["brass-ganesha"]); // partial word
    expect((await suggestAll("idol brass")).products.map((p) => p.slug)).toEqual(["brass-ganesha"]); // any order
    expect((await suggestAll("shilp")).products).toHaveLength(1); // brand
    expect((await suggestAll("GN-1")).products).toHaveLength(1); // SKU prefix
    expect((await suggestAll("brass clay")).products).toHaveLength(0); // all words must match
    expect((await suggestAll("draft")).products).toHaveLength(0); // drafts are never suggested
    expect((await suggestAll("ganesha")).products[0]).toMatchObject({ name: "Brass Ganesha Idol", price: 150000, salePrice: 120000, inStock: true });
    await createProduct(prod({ name: "Diwali Kit", slug: "kit", sku: "K1", shortDescription: "Includes a Ganesha photo" }));
    await Product.updateOne({ slug: "kit" }, { $set: { soldCount: 999 } }); // best seller, but only mentions Ganesha in its description
    expect((await suggestAll("ganesha")).products.map((p) => p.slug)).toEqual(["brass-ganesha", "kit"]); // name matches rank first
    expect((await suggestAll("anesha")).products).toHaveLength(0); // matches word starts, not the middle of words
  });

  it("treats typed text literally (no regex injection) and never throws on odd input", async () => {
    await createProduct(prod({ name: "Plain", slug: "plain", sku: "P1" }));
    for (const q of [".*", "(", "[a-", "\\", "a|b", "$^"]) { const r = await suggestAll(q); expect(r.products, q).toHaveLength(0); }
    expect((await list({ q: ".*" }, true)).total).toBe(0);
  });

  it("hides products in inactive categories, and suggests only active categories", async () => {
    const shown = await createCategory({ ...emptyCategory, name: "Brass Items", slug: "brass-items" });
    const hidden = await createCategory({ ...emptyCategory, name: "Brass Hidden", slug: "brass-hidden", isActive: false });
    await createProduct(prod({ name: "Brass lamp", slug: "lamp", sku: "L1", category: shown.id }));
    await createProduct(prod({ name: "Brass bell", slug: "bell", sku: "B1", category: hidden.id }));
    const r = await suggestAll("brass");
    expect(r.products.map((p) => p.slug)).toEqual(["lamp"]);
    expect(r.categories.map((c) => c.path)).toEqual(["brass-items"]);
  });

  it("includes live guides, aarti/mantras, blog posts and guides, never drafts", async () => {
    const mkVidhi = async (title: string, slug: string, publish: boolean) => { const v = await createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title, slug, summary: "x", steps: [{ title: "", body: "do" }], ...REVIEWED })); if (publish) await setVidhiPublishState(v.id, { action: "publish" }); };
    await mkVidhi("Ganesh Chaturthi Pooja", "ganesh-pooja", true); await mkVidhi("Ganesh draft guide", "ganesh-draft", false);
    const mkDev = async (title: string, slug: string, type: "aarti" | "mantra", publish: boolean, extra: object = {}) => {
      const d = await createDevotional(devotionalInputSchema.parse({ ...emptyDevotional, title, slug, type, lyrics: "text", ...REVIEWED, ...extra })); if (publish) await setDevotionalPublishState(d.id, { action: "publish" });
    };
    await mkDev("Ganesh Aarti", "ganesh-aarti", "aarti", true, { deity: "Ganesha" }); await mkDev("Vakratunda Ganesh Mantra", "ganesh-mantra", "mantra", true); await mkDev("Ganesh unpublished", "ganesh-unpub", "aarti", false);
    const mkPost = async (kind: "blog" | "guide", slug: string, title: string, publish: boolean) => {
      const p = await createPage(pageInputSchema.parse({ kind, title, slug, description: "about ganesh", seo: emptySeo, sections: [{ id: "s1", type: "richtext", enabled: true, data: { markdown: "x" } }] })); if (publish) await setPublishState(p.id, { action: "publish" });
    };
    await mkPost("blog", "blog/eco-ganesh", "An eco-friendly Ganesh festival", true); await mkPost("guide", "guides/ganesh-guide", "Ganesh guide", true); await mkPost("blog", "blog/ganesh-draft", "Ganesh draft post", false);
    const r = await suggestAll("ganesh");
    expect(r.vidhi.map((v) => v.slug)).toEqual(["ganesh-pooja"]);
    expect(r.devotionals.map((d) => d.slug).sort()).toEqual(["ganesh-aarti", "ganesh-mantra"]);
    expect(r.posts.map((p) => p.slug).sort()).toEqual(["blog/eco-ganesh", "guides/ganesh-guide"]);
    expect(r.total).toBe(1 + 2 + 2);
    expect(await contentCounts("ganesh")).toEqual({ vidhi: 1, devotional: 2, posts: 2 });
    expect(await contentCounts("a")).toEqual({ vidhi: 0, devotional: 0, posts: 0 });
    expect((await suggestAll("ganesha")).devotionals.map((d) => d.slug)).toEqual(["ganesh-aarti"]); // deity field
  });

  it("product listing: exact text search first; partial mode finds word starts and keeps filters and facets working", async () => {
    await createProduct(prod({ name: "Brass Ganesha Idol", slug: "g1", sku: "G1", attributes: [{ name: "Deity", value: "Ganesha" }], price: 100000 }));
    await createProduct(prod({ name: "Clay Ganesha Idol", slug: "g2", sku: "G2", attributes: [{ name: "Deity", value: "Ganesha" }], price: 30000 }));
    await createProduct(prod({ name: "Lakshmi Idol", slug: "l1", sku: "L1", attributes: [{ name: "Deity", value: "Lakshmi" }] }));
    expect((await list({ q: "gane" })).total).toBe(0); // full-text matches whole (stemmed) words only
    expect((await list({ q: "gane" }, true)).items.map((i) => i.slug).sort()).toEqual(["g1", "g2"]);
    expect((await list({ q: "gane", maxPrice: 50000 }, true)).items.map((i) => i.slug)).toEqual(["g2"]); // price filter still applies
    expect((await list({ q: "gane", sort: "price-asc" }, true)).items.map((i) => i.slug)).toEqual(["g2", "g1"]);
    expect((await list({ q: "idol brass" }, true)).items.map((i) => i.slug)).toEqual(["g1"]);
    const facets = await findFacets(publicProductsSchema.parse({ q: "gane" }), { partial: true });
    expect(facets.find((f) => f.key === "deity")?.values).toEqual([{ value: "Ganesha", count: 2 }]); // facets follow the search
    expect((await list({ q: "brass", deity: "Ganesha" })).items.map((i) => i.slug)).toEqual(["g1"]); // refinements still combine with exact search
    expect((await list({ q: "gane", deity: "Lakshmi" }, true)).total).toBe(0);
  });
});
