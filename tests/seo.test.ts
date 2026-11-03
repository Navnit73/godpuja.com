import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { Category } from "@/server/models/Category";
import { Page } from "@/server/models/Page";
import { Product } from "@/server/models/Product";
import { Redirect } from "@/server/models/Redirect";
import { Settings } from "@/server/models/Settings";
import { createCategory, updateCategory } from "@/server/services/categories";
import { createPage, deletePage, setPublishState, updatePage } from "@/server/services/pages";
import { createProduct, findPublicProduct } from "@/server/services/products";
import { createRedirect, deleteRedirect, listRedirects } from "@/server/services/redirects";
import { getSeoSettings, updateSeoSettings } from "@/server/services/settings";
import { findSitemapEntries } from "@/server/services/sitemap";
import { _resetRouteCache, checkPath, redirectFor } from "@/server/route-check";
import { ApiError } from "@/server/api";
import { can } from "@/server/auth/permissions";
import { productLd, serializeJsonLd, siteLd, breadcrumbLd } from "@/lib/jsonld";
import { defaultSeoSettings, redirectInputSchema, seoSettingsSchema } from "@/lib/validation/seo";
import { emptyCategory, type ProductInput } from "@/lib/validation/catalog";
import { emptySeo } from "@/lib/validation/pages";

const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Diya", slug: "diya", sku: "D1", shortDescription: "Brass lamp", description: "", images: [], category: null, brand: "GodPuja", price: 60000, salePrice: 50000, stock: 5,
  lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [], shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const page = (slug: string, over = {}) => ({ title: slug.toUpperCase(), slug, description: "", sections: [], seo: { ...emptySeo }, ...over });
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
};

describe("SEO validation", () => {
  it("redirects: normalised, internal paths blocked, no self-redirects, external must be https", () => {
    expect(redirectInputSchema.parse({ from: "/Old-Page/", to: "/new" })).toEqual({ from: "/old-page", to: "/new" });
    for (const from of ["/", "/admin", "/admin/x", "/api/x", "/_next/x", "/login", "/order/1", "old", "//evil.com", "/a b", "/x?y=1"]) {
      expect(redirectInputSchema.safeParse({ from, to: "/new" }).success, from).toBe(false);
    }
    expect(redirectInputSchema.safeParse({ from: "/a", to: "/A/" }).success).toBe(false); // to itself after normalising
    expect(redirectInputSchema.safeParse({ from: "/a", to: "http://x.com" }).success).toBe(false);
    expect(redirectInputSchema.safeParse({ from: "/a", to: "javascript:alert(1)" }).success).toBe(false);
    expect(redirectInputSchema.safeParse({ from: "/a", to: "https://partner.example.com/x" }).success).toBe(true);
  });
  it("settings: lengths, handle format, safe image URLs", () => {
    expect(seoSettingsSchema.safeParse(defaultSeoSettings).success).toBe(true);
    expect(seoSettingsSchema.safeParse({ ...defaultSeoSettings, defaultTitle: "x".repeat(71) }).success).toBe(false);
    expect(seoSettingsSchema.safeParse({ ...defaultSeoSettings, twitterHandle: "godpuja" }).success).toBe(false);
    expect(seoSettingsSchema.safeParse({ ...defaultSeoSettings, defaultOgImage: "javascript:1" }).success).toBe(false);
  });
});

// JSON-LD objects are free-form schema.org data; tests read nested fields by name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ld = Record<string, any>;

describe("JSON-LD", () => {
  it("escapes characters that could break out of the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>", x: "a b" });
    expect(out).not.toContain("</script");
    expect(out).not.toContain(" ");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>"); // still the same data
  });
  it("product offers use rupees, sale price, availability; variants become an AggregateOffer", () => {
    const base = { id: "1", name: "Diya", slug: "diya", sku: "D1", shortDescription: "", descriptionHtml: "", images: [{ url: "https://x/a.png", alt: "" }], brand: "", price: 60000, salePrice: 50000, inStock: true, upcoming: false, isFeatured: false, category: null, categoryPath: null, attributes: [], variants: [], seo: { ...emptySeo }, freeShipping: false, breadcrumbs: [] };
    const ld = productLd("https://godpuja.com/", base) as Ld;
    expect(ld.offers).toMatchObject({ "@type": "Offer", price: "500.00", priceCurrency: "INR", availability: "https://schema.org/InStock", url: "https://godpuja.com/product/diya" });
    expect(ld).not.toHaveProperty("brand");
    expect((productLd("https://godpuja.com", { ...base, upcoming: true }) as Ld).offers).toMatchObject({ availability: "https://schema.org/PreOrder" });
    const v = productLd("https://godpuja.com", { ...base, variants: [{ sku: "A", options: {}, price: 10000, salePrice: null, inStock: false }, { sku: "B", options: {}, price: 30000, salePrice: 25000, inStock: false }] }) as Ld;
    expect(v.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: "100.00", highPrice: "250.00", offerCount: 2, availability: "https://schema.org/OutOfStock" });
    expect(breadcrumbLd("https://g.com", [{ name: "Home", path: "/" }, { name: "Kits", path: "/category/kits" }]).itemListElement[1]).toEqual({ "@type": "ListItem", position: 2, name: "Kits", item: "https://g.com/category/kits" });
    const [org, site] = siteLd("https://g.com", { siteName: "G", logoUrl: "", sameAs: ["https://instagram.com/g"] }) as Ld[];
    expect(org.sameAs).toEqual(["https://instagram.com/g"]);
    expect(site.potentialAction.target.urlTemplate).toBe("https://g.com/search?q={search_term_string}");
  });
});

describe("SEO data (godpuja_test)", () => {
  const wipe = () => Promise.all([Category.deleteMany({}), Page.deleteMany({}), Product.deleteMany({}), Redirect.deleteMany({}), Settings.deleteMany({})]);
  beforeAll(async () => { await connectDB(); if (mongoose.connection.name !== "godpuja_test") throw new Error("wrong db"); await Promise.all([Category.syncIndexes(), Page.syncIndexes(), Product.syncIndexes(), Redirect.syncIndexes(), Settings.syncIndexes()]); });
  beforeEach(async () => { await wipe(); _resetRouteCache(); });
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });

  it("settings: defaults, first save create-only, stale save 409", async () => {
    expect((await getSeoSettings()).updatedAt).toBeNull();
    const s = await updateSeoSettings({ ...defaultSeoSettings, siteName: "GodPuja Store", baseUpdatedAt: null });
    await fails(updateSeoSettings({ ...defaultSeoSettings, baseUpdatedAt: null }), "CONFLICT");
    await updateSeoSettings({ ...defaultSeoSettings, siteName: "B", baseUpdatedAt: s.updatedAt });
    await fails(updateSeoSettings({ ...defaultSeoSettings, siteName: "C", baseUpdatedAt: s.updatedAt }), "CONFLICT");
  });

  it("manual redirects: chains are collapsed, loops refused, existing redirects re-pointed, delete works", async () => {
    await createRedirect({ from: "/b", to: "/c" });
    expect(await createRedirect({ from: "/a", to: "/b" })).toEqual({ from: "/a", to: "/c" }); // a -> c, not a -> b -> c
    await fails(createRedirect({ from: "/c", to: "/a" }), "VALIDATION_ERROR"); // c -> a -> c
    await createRedirect({ from: "/c", to: "/d" }); // re-points a and b to d
    const map = Object.fromEntries((await Redirect.find().lean()).map((r) => [r.from, r.to]));
    expect(map).toEqual({ "/a": "/d", "/b": "/d", "/c": "/d" });
    const ext = await createRedirect({ from: "/promo", to: "https://partner.example.com/diwali" });
    expect(ext.to).toBe("https://partner.example.com/diwali");
    const list = await listRedirects({ q: "promo", page: 1, limit: 25 });
    expect(list.items).toHaveLength(1);
    await deleteRedirect(list.items[0].id);
    expect(await Redirect.countDocuments({ from: "/promo" })).toBe(0);
  });

  it("CMS page slug changes record a 301; re-creating the old URL clears it; deleting drops redirects into it", async () => {
    const p = await createPage(page("about"));
    await setPublishState(p.id, { action: "publish" });
    const cur = await Page.findById(p.id).lean();
    await updatePage(p.id, page("about-us"), cur!.updatedAt.toISOString());
    expect((await Redirect.findOne({ from: "/about" }).lean())?.to).toBe("/about-us");
    await createPage(page("about"));
    expect(await Redirect.countDocuments({ from: "/about" })).toBe(0);
    await createRedirect({ from: "/old-about", to: "/about-us" });
    await deletePage(p.id);
    expect(await Redirect.countDocuments({ to: "/about-us" })).toBe(0);
  });

  it("route check: real 404 decisions for products, categories and CMS pages; app routes are left alone", async () => {
    const c = await createCategory({ ...emptyCategory, name: "Kits", slug: "kits" });
    await createProduct(prod({ category: c.id }));
    await createProduct(prod({ slug: "draft-one", sku: "D2", status: "draft" }));
    const live = await createPage(page("about")); await setPublishState(live.id, { action: "publish" });
    await createPage(page("secret"));
    const v = async (p: string) => (await checkPath(p)).kind;
    expect(await v("/")).toBe("ok");
    expect(await v("/product/diya")).toBe("ok");
    expect(await v("/product/draft-one")).toBe("notFound");
    expect(await v("/product/missing")).toBe("notFound");
    expect(await v("/product/a/b")).toBe("notFound");
    expect(await v("/product/BAD")).toBe("notFound");
    expect(await v("/category/kits")).toBe("ok");
    expect(await v("/category/nope")).toBe("notFound");
    expect(await v("/category/a/b/c/d")).toBe("notFound");
    expect(await v("/about")).toBe("ok");
    expect(await v("/secret")).toBe("notFound"); // draft
    expect(await v("/no-such-page")).toBe("notFound");
    expect(await v("/a/b/c/d")).toBe("notFound");
    for (const ok of ["/cart", "/checkout", "/search", "/login", "/order/abc/confirmation", "/preview/tok"]) expect(await v(ok), ok).toBe("ok");
  });

  it("route check caches answers (positive 60 s / negative 15 s) and redirect lookups read the table", async () => {
    expect((await checkPath("/product/later")).kind).toBe("notFound");
    await createProduct(prod({ slug: "later", sku: "L" }));
    expect((await checkPath("/product/later")).kind).toBe("notFound"); // negative answer still cached
    _resetRouteCache();
    expect((await checkPath("/product/later")).kind).toBe("ok");
    await createRedirect({ from: "/old", to: "/new" });
    _resetRouteCache();
    expect(await redirectFor("/old")).toBe("/new");
    expect(await redirectFor("/nothing")).toBeNull();
  });

  it("sitemap lists only indexable public URLs", async () => {
    const a = await createCategory({ ...emptyCategory, name: "Kits", slug: "kits" });
    const hidden = await createCategory({ ...emptyCategory, name: "Hidden", slug: "hidden" });
    await createCategory({ ...emptyCategory, name: "Kid", slug: "kid", parent: hidden.id });
    await createCategory({ ...emptyCategory, name: "Quiet", slug: "quiet", seo: { ...emptySeo, noindex: true } });
    await createProduct(prod({ category: a.id }));
    await createProduct(prod({ slug: "in-hidden", sku: "H", category: hidden.id }));
    await createProduct(prod({ slug: "draft", sku: "DR", status: "draft" }));
    await createProduct(prod({ slug: "noidx", sku: "NI", seo: { ...emptySeo, noindex: true } }));
    const home = await createPage(page("home")); await setPublishState(home.id, { action: "publish" });
    const about = await createPage(page("about")); await setPublishState(about.id, { action: "publish" });
    await createPage(page("draft-page"));
    await updateCategory(hidden.id, { ...emptyCategory, name: "Hidden", slug: "hidden", isActive: false, baseUpdatedAt: hidden.updatedAt });
    const paths = (await findSitemapEntries()).map((e) => e.path).sort();
    expect(paths).toEqual(["/", "/about", "/category/kits", "/product/diya"]);
    expect(await findPublicProduct("in-hidden")).toBeNull();
  });
});

describe("SEO permissions", () => {
  it("seo:write is for editor/admin/superadmin", () => {
    expect(can("editor", "seo:write")).toBe(true);
    expect(can("manager", "seo:write")).toBe(false);
    expect(can("customer", "seo:write")).toBe(false);
  });
});
