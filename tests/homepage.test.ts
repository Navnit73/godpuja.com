import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { Category } from "@/server/models/Category";
import { Homepage } from "@/server/models/Homepage";
import { Product } from "@/server/models/Product";
import { createCategory, updateCategory } from "@/server/services/categories";
import { findPublicHomepage, getHomepage, updateHomepage } from "@/server/services/homepage";
import { createProduct } from "@/server/services/products";
import { Page } from "@/server/models/Page";
import { createPage, setPublishState } from "@/server/services/pages";
import { ApiError } from "@/server/api";
import { can } from "@/server/auth/permissions";
import { MAX_RAILS, defaultData, homeSectionSchema, homepageInputSchema, updateHomepageSchema, type HomeSection, type SectionType } from "@/lib/validation/homepage";
import { emptyCategory, type ProductInput } from "@/lib/validation/catalog";
import { emptySeo } from "@/lib/validation/pages";

let n = 0;
const sec = <T extends SectionType>(type: T, data: Record<string, unknown> = {}, enabled = true) =>
  ({ id: `s${++n}`, type, enabled, data: { ...structuredClone(defaultData[type]), ...data } }) as unknown as HomeSection;
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "P", slug: "p", sku: "P1", shortDescription: "", description: "", images: [], category: null, brand: "", price: 10000, salePrice: null, stock: 5, lowStockThreshold: 5,
  status: "active", isFeatured: false, attributes: [], variants: [], shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
};

describe("homepage validation", () => {
  const ok = (s: HomeSection) => homeSectionSchema.safeParse(s).success;
  it("accepts every default-shaped section once required fields are filled", () => {
    expect(ok(sec("hero", { heading: "Welcome" }))).toBe(true);
    expect(ok(sec("banner", { items: [{ imageUrl: "https://x.com/a.png", imageAlt: "a", heading: "", text: "", linkUrl: "/sale" }] }))).toBe(true);
    expect(ok(sec("featuredCategories", { categoryIds: ["a".repeat(24)] }))).toBe(true);
    for (const t of ["featuredProducts", "latestProducts", "bestSellers"] as const) expect(ok(sec(t))).toBe(true);
    expect(ok(sec("richText", { markdown: "hi" }))).toBe(true);
    expect(ok(sec("imageText", { heading: "Hi" }))).toBe(true);
    expect(ok(sec("testimonials", { items: [{ quote: "Great", author: "Asha", role: "" }] }))).toBe(true);
    expect(ok(sec("offer", { heading: "Diwali sale" }))).toBe(true);
    expect(ok(sec("custom"))).toBe(true);
    expect(ok(sec("latestPosts"))).toBe(true);
    expect(ok(sec("latestPosts", { kind: "all", limit: 12 }))).toBe(true);
    expect(ok(sec("latestPosts", { limit: 13 }))).toBe(false);
    expect(ok(sec("latestPosts", { kind: "page" }))).toBe(false);
  });
  it("enforces required content, alt text, link pairs and limits", () => {
    expect(ok(sec("hero"))).toBe(false); // heading required
    expect(ok(sec("hero", { heading: "x", imageUrl: "https://x.com/a.png" }))).toBe(false); // alt required
    expect(ok(sec("hero", { heading: "x", ctaLabel: "Go" }))).toBe(false); // button needs link
    expect(ok(sec("featuredCategories"))).toBe(false); // none chosen
    expect(ok(sec("featuredCategories", { categoryIds: Array.from({ length: 9 }, (_, i) => String(i).repeat(24).slice(0, 24)) }))).toBe(false);
    expect(ok(sec("featuredCategories", { categoryIds: ["a".repeat(24), "a".repeat(24)] }))).toBe(false); // duplicates
    expect(ok(sec("featuredProducts", { limit: 0 }))).toBe(false);
    expect(ok(sec("featuredProducts", { limit: 13 }))).toBe(false);
    expect(ok(sec("featuredProducts", { category: "../x" }))).toBe(false);
    expect(ok(sec("testimonials", { items: [] }))).toBe(false);
    expect(ok(sec("offer", { heading: "x", expiresAt: "tomorrow" }))).toBe(false);
  });
  it.each(["javascript:alert(1)", "//evil.com", "data:text/html,x", "ftp://x.com"])("rejects dangerous link/image url %j", (u) => {
    expect(ok(sec("hero", { heading: "x", ctaLabel: "Go", ctaUrl: u }))).toBe(false);
    expect(ok(sec("hero", { heading: "x", imageUrl: u, imageAlt: "a" }))).toBe(false);
    expect(ok(sec("banner", { items: [{ imageUrl: "https://x.com/a.png", imageAlt: "a", heading: "", text: "", linkUrl: u }] }))).toBe(false);
    expect(ok(sec("offer", { heading: "x", ctaLabel: "Go", ctaUrl: u }))).toBe(false);
  });
  it("rejects unknown types, duplicate ids, >30 sections, >6 product rails; strips unknown keys", () => {
    expect(homeSectionSchema.safeParse({ id: "a", type: "script", enabled: true, data: {} }).success).toBe(false);
    const a = sec("richText"); const b = { ...sec("richText"), id: a.id };
    expect(homepageInputSchema.safeParse({ sections: [a, b] }).success).toBe(false);
    expect(homepageInputSchema.safeParse({ sections: Array.from({ length: 31 }, () => sec("richText")) }).success).toBe(false);
    expect(homepageInputSchema.safeParse({ sections: Array.from({ length: MAX_RAILS + 1 }, () => sec("latestProducts")) }).success).toBe(false);
    expect(homepageInputSchema.safeParse({ sections: Array.from({ length: MAX_RAILS }, () => sec("latestProducts")) }).success).toBe(true);
    const parsed = homeSectionSchema.parse({ ...sec("richText"), evil: 1, data: { markdown: "x", evil: 2 } }) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("evil");
    expect(parsed.data).not.toHaveProperty("evil");
  });
  it("URL errors carry a helpful message (not 'Invalid input'); ids are restricted; one hero; imageText not empty", () => {
    const msg = (s: HomeSection) => { const r = homeSectionSchema.safeParse(s); return r.success ? "" : r.error.issues[0].message; };
    expect(msg(sec("hero", { heading: "x", ctaLabel: "Go", ctaUrl: "javascript:alert(1)" }))).toMatch(/path like \/about/);
    expect(msg(sec("hero", { heading: "x", imageUrl: "//evil.com", imageAlt: "a" }))).toMatch(/http\(s\) URL/);
    expect(msg(sec("hero", { heading: "x", ctaLabel: "Go", ctaUrl: "/" + "a".repeat(2100) }))).not.toBe("");
    expect(homeSectionSchema.safeParse({ ...sec("richText"), id: "has space" }).success).toBe(false);
    expect(homepageInputSchema.safeParse({ sections: [sec("hero", { heading: "a" }), sec("hero", { heading: "b" })] }).success).toBe(false);
    expect(ok(sec("imageText"))).toBe(false); // empty block
    expect(ok(sec("imageText", { heading: "Hi" }))).toBe(true);
  });
  it("update schema needs baseUpdatedAt (null allowed for the first save)", () => {
    expect(updateHomepageSchema.safeParse({ sections: [] }).success).toBe(false);
    expect(updateHomepageSchema.safeParse({ sections: [], baseUpdatedAt: null }).success).toBe(true);
  });
});

describe("homepage service (godpuja_test)", () => {
  const wipe = () => Promise.all([Homepage.deleteMany({}), Category.deleteMany({}), Product.deleteMany({})]);
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Homepage.syncIndexes(), Category.syncIndexes(), Product.syncIndexes()]);
  });
  beforeEach(wipe);
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });

  it("defaults before first save; first save is create-only; stale and concurrent saves lose", async () => {
    expect((await getHomepage())).toEqual({ sections: [], updatedAt: null });
    expect(await findPublicHomepage()).toBeNull();
    const first = await updateHomepage({ sections: [sec("richText", { markdown: "a" })], baseUpdatedAt: null });
    await fails(updateHomepage({ sections: [], baseUpdatedAt: null }), "CONFLICT");
    await updateHomepage({ sections: [sec("richText", { markdown: "b" })], baseUpdatedAt: first.updatedAt });
    await fails(updateHomepage({ sections: [], baseUpdatedAt: first.updatedAt }), "CONFLICT");
    const cur = await getHomepage();
    const r = await Promise.allSettled([updateHomepage({ sections: [], baseUpdatedAt: cur.updatedAt }), updateHomepage({ sections: [sec("custom", { markdown: "z" })], baseUpdatedAt: cur.updatedAt })]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("reorder and enable/disable are what visitors get", async () => {
    const a = sec("richText", { markdown: "AAA" }); const b = sec("richText", { markdown: "BBB" }); const c = sec("richText", { markdown: "CCC" }, false);
    const first = await updateHomepage({ sections: [a, b, c], baseUpdatedAt: null });
    expect((await findPublicHomepage())!.sections.map((s) => s.id)).toEqual([a.id, b.id]); // disabled c hidden
    const next = [{ ...c, enabled: true }, b, a];
    await updateHomepage({ sections: next, baseUpdatedAt: first.updatedAt });
    expect((await findPublicHomepage())!.sections.map((s) => s.id)).toEqual([c.id, b.id, a.id]);
  });

  it("renders markdown safely and drops empty text blocks", async () => {
    await updateHomepage({ sections: [sec("richText", { markdown: "**ok**\n\n<script>alert(1)</script>" }), sec("richText", { markdown: "  " }), sec("custom", { markdown: "[x](javascript:alert(1))" })], baseUpdatedAt: null });
    const s = (await findPublicHomepage())!.sections;
    expect(s).toHaveLength(2);
    const html = JSON.stringify(s);
    expect(html).toContain("<strong>ok</strong>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("a malformed stored section is skipped instead of breaking the page", async () => {
    await Homepage.create({ key: "main", sections: [{ id: "bad", type: "banner", enabled: true, data: {} }, sec("richText", { markdown: "still here" })] });
    const s = (await findPublicHomepage())!.sections;
    expect(s).toHaveLength(1);
    expect(s[0].type).toBe("richText");
  });

  it("rails keep a stable order when many products tie", async () => {
    for (let i = 0; i < 6; i++) await createProduct(prod({ name: `P${i}`, slug: `p${i}`, sku: `T${i}` }));
    await Product.updateMany({}, { $set: { soldCount: 0, createdAt: new Date("2026-01-01") } });
    await updateHomepage({ sections: [sec("bestSellers", { limit: 4 }), sec("latestProducts", { limit: 4 })], baseUpdatedAt: null });
    const names = async () => ((await findPublicHomepage())!.sections as unknown as { products: { name: string }[] }[]).map((r) => r.products.map((p) => p.name).join(","));
    const first = await names();
    for (let i = 0; i < 3; i++) expect(await names()).toEqual(first);
  });

  it("latest posts: shows live posts of the chosen kind with a view-all link; hidden when there are none", async () => {
    await Page.deleteMany({});
    await updateHomepage({ sections: [sec("latestPosts", { kind: "blog", limit: 2 }), sec("latestPosts", { kind: "guide" })], baseUpdatedAt: null });
    expect((await findPublicHomepage())!.sections).toHaveLength(0);
    for (const slug of ["blog/a", "blog/b", "blog/c"]) {
      const p = await createPage({ kind: "blog", title: slug, slug, description: "", seo: { ...emptySeo }, sections: [] });
      await setPublishState(p.id, { action: "publish" });
    }
    await createPage({ kind: "guide", title: "Draft guide", slug: "guides/draft", description: "", seo: { ...emptySeo }, sections: [] });
    const out = (await findPublicHomepage())!.sections;
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "latestPosts", viewAll: "/blog", showKind: false });
    expect((out[0] as { posts: unknown[] }).posts).toHaveLength(2);
    await Page.deleteMany({});
  });

  it("offers disappear after expiry without an edit", async () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    await updateHomepage({ sections: [sec("offer", { heading: "Sale", expiresAt: soon }), sec("offer", { heading: "Always" })], baseUpdatedAt: null });
    expect((await findPublicHomepage())!.sections).toHaveLength(2);
    const later = await findPublicHomepage(new Date(Date.now() + 120_000));
    expect(later!.sections.map((s) => (s as { heading: string }).heading)).toEqual(["Always"]);
  });

  it("product rails: featured / latest / best sellers, category scoping, limits, no stock leak, empty rails hidden", async () => {
    const kits = await createCategory({ ...emptyCategory, name: "Kits", slug: "kits" });
    const idols = await createCategory({ ...emptyCategory, name: "Idols", slug: "idols" });
    await createProduct(prod({ name: "Old kit", slug: "old-kit", sku: "K1", category: kits.id, isFeatured: true }));
    await new Promise((r) => setTimeout(r, 15));
    await createProduct(prod({ name: "New kit", slug: "new-kit", sku: "K2", category: kits.id }));
    await createProduct(prod({ name: "Idol", slug: "idol", sku: "I1", category: idols.id, isFeatured: true }));
    await createProduct(prod({ name: "Draft", slug: "draft", sku: "D1", status: "draft", isFeatured: true }));
    await Product.updateOne({ slug: "old-kit" }, { $set: { soldCount: 50 } });
    await updateHomepage({
      sections: [
        sec("featuredProducts", { heading: "Featured" }), sec("latestProducts", { heading: "Latest", limit: 2 }), sec("bestSellers", { heading: "Best", category: "kits" }),
        sec("featuredProducts", { heading: "Scoped", category: "idols", limit: 1 }), sec("latestProducts", { heading: "Nothing", category: "ghost" }),
      ], baseUpdatedAt: null,
    });
    const home = (await findPublicHomepage())!;
    const rail = (h: string) => home.sections.find((s) => "heading" in s && s.heading === h) as { products: { name: string; category: string | null }[]; viewAll: string | null } | undefined;
    expect(rail("Featured")!.products.map((p) => p.name).sort()).toEqual(["Idol", "Old kit"]); // draft excluded
    expect(rail("Latest")!.products).toHaveLength(2);
    expect(rail("Latest")!.products[0].name).not.toBe("Draft");
    expect(rail("Best")!.products.map((p) => p.name)).toEqual(["Old kit", "New kit"]); // by soldCount, scoped
    expect(rail("Best")!.viewAll).toBe("/category/kits");
    expect(rail("Scoped")!.products.map((p) => p.name)).toEqual(["Idol"]);
    expect(rail("Nothing")).toBeUndefined();
    expect(JSON.stringify(home)).not.toMatch(/"stock"/);
  });

  it("featured categories: keeps chosen order, hides inactive/deleted and anything under an inactive parent", async () => {
    const a = await createCategory({ ...emptyCategory, name: "A", slug: "a" });
    const b = await createCategory({ ...emptyCategory, name: "B", slug: "b" });
    const c = await createCategory({ ...emptyCategory, name: "C", slug: "c", parent: b.id });
    const d = await createCategory({ ...emptyCategory, name: "D", slug: "d" });
    const ghost = new mongoose.Types.ObjectId().toHexString();
    await updateHomepage({ sections: [sec("featuredCategories", { categoryIds: [d.id, c.id, ghost, a.id] })], baseUpdatedAt: null });
    expect(((await findPublicHomepage())!.sections[0] as { categories: { name: string }[] }).categories.map((x) => x.name)).toEqual(["D", "C", "A"]);
    await updateCategory(b.id, { ...emptyCategory, name: "B", slug: "b", isActive: false, baseUpdatedAt: b.updatedAt }); // hides C via its parent
    await updateCategory(d.id, { ...emptyCategory, name: "D", slug: "d", isActive: false, baseUpdatedAt: d.updatedAt });
    expect(((await findPublicHomepage())!.sections[0] as { categories: { name: string }[] }).categories.map((x) => x.name)).toEqual(["A"]);
    await updateCategory(a.id, { ...emptyCategory, name: "A", slug: "a", isActive: false, baseUpdatedAt: a.updatedAt });
    expect((await findPublicHomepage())!.sections).toHaveLength(0); // section with nothing to show disappears
  });

  it("rail queries are index-backed (no collection scans)", async () => {
    await createProduct(prod());
    const stages = (plan: unknown): string[] => { const s: string[] = []; const walk = (x: unknown) => { if (x && typeof x === "object") { const o = x as Record<string, unknown>; if (typeof o.stage === "string") s.push(o.stage); Object.values(o).forEach(walk); } }; walk(plan); return s; };
    const qs: Record<string, mongoose.Query<unknown[], unknown>> = {
      featured: Product.find({ status: "active", isFeatured: true }).sort({ createdAt: -1, _id: -1 }).limit(8),
      latest: Product.find({ status: "active" }).sort({ createdAt: -1, _id: -1 }).limit(8),
      best: Product.find({ status: "active" }).sort({ soldCount: -1, _id: -1 }).limit(8),
    };
    for (const [name, q] of Object.entries(qs)) {
      const st = stages(((await q.explain("queryPlanner")) as unknown as { queryPlanner: { winningPlan: unknown } }).queryPlanner.winningPlan);
      expect(st.some((x) => /IXSCAN/.test(x)), `${name}: ${st.join(">")}`).toBe(true);
      expect(st, name).not.toContain("COLLSCAN");
      expect(st, `${name} should not sort in memory`).not.toContain("SORT");
    }
  });
});

describe("homepage permissions", () => {
  it("home:write is for editor/admin/superadmin only", () => {
    expect(can("content_manager", "home:write")).toBe(true);
    expect(can("admin", "home:write")).toBe(true);
    expect(can("store_manager", "home:write")).toBe(false);
    expect(can("customer", "home:write")).toBe(false);
  });
});
