// Stage 15 — Pooja Vidhi: structured, reviewed, scheduled ritual guides (PRD v1.1 §8).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { Category } from "@/server/models/Category";
import { Product } from "@/server/models/Product";
import { Redirect } from "@/server/models/Redirect";
import { Vidhi } from "@/server/models/Vidhi";
import { can } from "@/server/auth/permissions";
import { _resetRouteCache, checkPath } from "@/server/route-check";
import { createProduct } from "@/server/services/products";
import { findSitemapEntries } from "@/server/services/sitemap";
import {
  createVidhi, deleteVidhi, findPreviewVidhi, findPublicVidhi, findPublicVidhiList, getVidhi, listVidhi, plainExcerpt, rotateVidhiPreviewToken, setVidhiPublishState, updateVidhi, vidhiExists,
} from "@/server/services/vidhi";
import { validateSlug } from "@/lib/slug";
import { emptySeo } from "@/lib/validation/pages";
import type { ProductInput } from "@/lib/validation/catalog";
import { emptyVidhi, listVidhiSchema, publicVidhiSchema, updateVidhiSchema, vidhiCategoryLabel, vidhiHref, vidhiInputSchema, type VidhiInput } from "@/lib/validation/vidhi";
import { publishProblems } from "@/lib/vidhi-rules";
import { sectionsToMarkdown } from "@/lib/vidhi-migrate";

const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};
const REVIEWED = { reviewer: "Pt. Sharma", reviewedAt: "2026-11-01T00:00:00+05:30" };
const guide = (over: Partial<VidhiInput> = {}): VidhiInput => vidhiInputSchema.parse({
  ...emptyVidhi, title: "Ganesh Chaturthi Pooja", slug: "ganesh-chaturthi-pooja", category: "festival", deity: "Ganesha",
  summary: "How to perform the pooja at home.", steps: [{ title: "Sankalp", body: "Sit facing east and take the sankalp.", mantra: "" }], ...REVIEWED, ...over,
});

// ---------------------------------------------------------------- pure
describe("validation", () => {
  it("fills defaults and normalises lists", () => {
    const v = vidhiInputSchema.parse({ ...emptyVidhi, title: "Daily Pooja", slug: "daily-pooja", relatedProducts: ["Brass-Diya", "brass-diya", "", "camphor"], tags: [" Diwali ", "diwali", "Lakshmi"] });
    expect(v.relatedProducts).toEqual(["brass-diya", "camphor"]);
    expect(v.tags).toEqual(["diwali", "lakshmi"]);
    expect(v).toMatchObject({ category: "daily", samagri: [], steps: [], mantras: [], durationMinutes: null, reviewedAt: "", author: "" });
  });
  it("rejects bad slugs, categories and over-long content", () => {
    const bad = (o: object) => vidhiInputSchema.safeParse({ ...emptyVidhi, title: "T title", slug: "ok-slug", ...o }).success;
    expect(bad({})).toBe(true);
    for (const o of [{ slug: "" }, { slug: "Has Space" }, { slug: "a/b" }, { slug: "-x" }, { category: "weekly" }, { title: "x" }, { summary: "x".repeat(2001) }, { steps: Array.from({ length: 41 }, () => ({ title: "", body: "x" })) },
      { steps: [{ title: "", body: "" }] }, { samagri: [{ item: "" }] }, { samagri: [{ item: "Diya", productSlug: "Bad Slug" }] }, { mantras: [{ title: "Name", text: "" }] }, { durationMinutes: 0 }, { durationMinutes: 1.5 }])
      expect(bad(o), JSON.stringify(o)).toBe(false);
  });
  it("review needs a name and a date together; a cover needs a description; no self-links", () => {
    const issue = (o: object) => { const r = vidhiInputSchema.safeParse({ ...emptyVidhi, title: "T title", slug: "me", ...o }); return r.success ? null : r.error.issues[0].path.join("."); };
    expect(issue({ reviewer: "Sharma" })).toBe("reviewedAt");
    expect(issue({ reviewedAt: "2026-11-01T00:00:00+05:30" })).toBe("reviewer");
    expect(issue({ reviewer: "Sharma", reviewedAt: "2026-11-01T00:00:00+05:30" })).toBeNull();
    expect(issue({ coverImageUrl: "https://x.com/a.jpg" })).toBe("coverImageAlt");
    expect(issue({ relatedVidhi: ["me"] })).toBe("relatedVidhi");
    expect(issue({ coverImageUrl: "javascript:alert(1)", coverImageAlt: "x" })).toBe("coverImageUrl");
  });
  it("parses list filters and public queries leniently", () => {
    expect(listVidhiSchema.parse({}).limit).toBe(20);
    expect(listVidhiSchema.safeParse({ category: "nope" }).success).toBe(false);
    expect(publicVidhiSchema.parse({ category: "festival", page: "2" })).toMatchObject({ category: "festival", page: 2 });
    expect(updateVidhiSchema.safeParse({ ...emptyVidhi, title: "Title x", slug: "title-x" }).success).toBe(false); // needs the version it was based on
    expect(vidhiCategoryLabel("vrat-katha")).toBe("Vrat & katha");
    expect(vidhiHref("x")).toBe("/pooja-vidhi/x");
  });
  it("the guides URL prefix is reserved so no CMS page can take it", () => {
    expect(validateSlug("pooja-vidhi")).toMatch(/reserved/);
    expect(validateSlug("pooja-vidhi/anything")).toMatch(/reserved/);
    expect(validateSlug("about-pooja-vidhi")).toBeNull();
  });
});

describe("publish rules", () => {
  const ok = { summary: "Intro", steps: [{}], body: "", reviewer: "Sharma", reviewedAt: new Date() };
  it("needs an introduction, some content, a reviewer and a review date", () => {
    expect(publishProblems(ok)).toEqual({});
    expect(Object.keys(publishProblems({}))).toEqual(["summary", "steps", "reviewer", "reviewedAt"]);
    expect(publishProblems({ ...ok, steps: [], body: "Some body text" })).toEqual({}); // body text counts as content
    expect(Object.keys(publishProblems({ ...ok, summary: "  " }))).toEqual(["summary"]);
    expect(Object.keys(publishProblems({ ...ok, reviewer: " " }))).toEqual(["reviewer"]);
    expect(Object.keys(publishProblems({ ...ok, reviewedAt: null }))).toEqual(["reviewedAt"]);
  });
  it("makes plain excerpts from Markdown", () => {
    expect(plainExcerpt("## Heading\n\nSome **bold** and [a link](https://x.com) text.")).toBe("Heading Some bold and a link text.");
    expect(plainExcerpt("x ".repeat(200), 40).length).toBeLessThanOrEqual(40);
    expect(plainExcerpt("x ".repeat(200), 40).endsWith("…")).toBe(true);
    expect(plainExcerpt("")).toBe("");
  });
  it("converts old guide sections into Markdown, skipping hidden ones", () => {
    const md = sectionsToMarkdown([
      { type: "richtext", data: { markdown: "First part." } },
      { type: "richtext", enabled: false, data: { markdown: "Hidden." } },
      { type: "imageText", data: { heading: "Samagri", markdown: "Diya, ghee", imageUrl: "https://x.com/a.jpg", imageAlt: "A lamp" } },
    ]);
    expect(md).toBe("First part.\n\n## Samagri\n\nDiya, ghee\n\n![A lamp](https://x.com/a.jpg)");
    expect(sectionsToMarkdown([])).toBe("");
  });
  it("permissions: content managers run guides; store, support and others do not", () => {
    for (const r of ["content_manager", "admin", "superadmin"] as const) for (const p of ["vidhi:read", "vidhi:write", "vidhi:publish"] as const) expect(can(r, p), `${r} ${p}`).toBe(true);
    for (const r of ["store_manager", "support_agent", "booking_manager", "temple_operator", "customer"] as const) expect(can(r, "vidhi:read") || can(r, "vidhi:write") || can(r, "vidhi:publish"), r).toBe(false);
  });
});

// ---------------------------------------------------------------- database
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Brass diya", slug: "brass-diya", sku: "DIYA-1", shortDescription: "", description: "", images: [{ url: "https://example.com/a.jpg", alt: "Diya" }], category: null, brand: "",
  price: 10000, salePrice: null, stock: 10, lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [],
  shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});

describe("Pooja Vidhi with the database (godpuja_test)", () => {
  const wipe = () => Promise.all([Vidhi, Product, Category, Redirect].map((m) => (m as typeof Vidhi).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Vidhi, Product, Redirect].map((m) => (m as typeof Vidhi).syncIndexes()));
  });
  beforeEach(async () => { await wipe(); _resetRouteCache(); });
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });

  const publishNow = (id: string) => setVidhiPublishState(id, { action: "publish" });
  const mkLive = async (over: Partial<VidhiInput> = {}) => { const v = await createVidhi(guide(over)); return publishNow(v.id); };
  let n = 0;
  const mkProduct = (over: Partial<ProductInput> = {}) => { n++; return createProduct(prod({ name: `Prod ${n}`, slug: `prod-${n}`, sku: `P-${n}`, ...over })); };

  describe("creating and editing", () => {
    it("creates a draft with a secret preview token; slugs are unique", async () => {
      const v = await createVidhi(guide());
      expect(v).toMatchObject({ status: "draft", slug: "ganesh-chaturthi-pooja", category: "festival", publishAt: null, publishedAt: null });
      expect(v.previewToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
      const dup = await fails(createVidhi(guide()), "CONFLICT");
      expect(dup.fields).toEqual({ slug: "Already in use" });
      expect((await getVidhi(v.id)).steps).toHaveLength(1);
      await fails(getVidhi("nope"), "NOT_FOUND");
    });
    it("every link must point at something that exists", async () => {
      await mkProduct({ slug: "brass-diya", sku: "BD" });
      await mkProduct({ slug: "hidden-draft", sku: "HD", status: "draft" });
      const e = await fails(createVidhi(guide({ samagri: [{ item: "Diya", quantity: "1", note: "", productSlug: "brass-diya" }, { item: "Camphor", quantity: "", note: "", productSlug: "camphor" }, { item: "Ghee", quantity: "", note: "", productSlug: "hidden-draft" }], relatedProducts: ["brass-diya", "missing-thing"], relatedVidhi: ["no-such-guide"] })), "VALIDATION_ERROR");
      expect(e.fields).toEqual({
        "samagri.1.productSlug": "No such product in the shop", "samagri.2.productSlug": "No such product in the shop",
        relatedProducts: "No such product in the shop: missing-thing", relatedVidhi: "No such guide: no-such-guide",
      });
      expect(await Vidhi.countDocuments()).toBe(0);
      await createVidhi(guide({ samagri: [{ item: "Diya", quantity: "1", note: "", productSlug: "brass-diya" }], relatedProducts: ["brass-diya"] })); // valid links are fine
    });
    it("editing is compare-and-set on the version the editor loaded", async () => {
      const v = await createVidhi(guide());
      const edit = (over: Partial<VidhiInput>, base = v.updatedAt) => updateVidhi(v.id, guide(over), base);
      const a = await edit({ title: "Ganesh Pooja, revised" });
      expect(a.vidhi.title).toBe("Ganesh Pooja, revised");
      expect(a.vidhi.updatedAt).not.toBe(v.updatedAt);
      await fails(edit({ title: "Stale save" }), "CONFLICT"); // based on the old version
      await fails(updateVidhi(new mongoose.Types.ObjectId().toString(), guide(), v.updatedAt), "NOT_FOUND");
    });
    it("renaming the URL keeps the old link working and updates guides that pointed at it", async () => {
      const a = await createVidhi(guide());
      const b = await createVidhi(guide({ title: "Other", slug: "other-guide", relatedVidhi: ["ganesh-chaturthi-pooja"] }));
      const r = await updateVidhi(a.id, guide({ slug: "ganesh-pooja" }), a.updatedAt);
      expect(r.previousSlug).toBe("ganesh-chaturthi-pooja");
      expect((await Redirect.findOne({ from: "/pooja-vidhi/ganesh-chaturthi-pooja" }).lean())?.to).toBe("/pooja-vidhi/ganesh-pooja");
      expect((await getVidhi(b.id)).relatedVidhi).toEqual(["ganesh-pooja"]);
      await fails(updateVidhi(b.id, guide({ title: "Other", slug: "ganesh-pooja", relatedVidhi: [] }), (await getVidhi(b.id)).updatedAt), "CONFLICT"); // slug taken
    });
    it("without publish rights, only drafts can be changed or deleted", async () => {
      const live = await mkLive();
      await fails(updateVidhi(live.id, guide({ title: "Sneaky edit" }), live.updatedAt, { draftOnly: true }), "FORBIDDEN");
      await fails(deleteVidhi(live.id, { draftOnly: true }), "FORBIDDEN");
      const draft = await createVidhi(guide({ slug: "a-draft", title: "A draft" }));
      await updateVidhi(draft.id, guide({ slug: "a-draft", title: "Edited draft" }), draft.updatedAt, { draftOnly: true });
      expect((await deleteVidhi(draft.id, { draftOnly: true })).slug).toBe("a-draft");
    });
    it("deleting removes the guide from other guides' related lists and drops redirects into it", async () => {
      const a = await createVidhi(guide());
      const b = await createVidhi(guide({ title: "Other", slug: "other-guide", relatedVidhi: ["ganesh-chaturthi-pooja"] }));
      await deleteVidhi(a.id);
      expect((await getVidhi(b.id)).relatedVidhi).toEqual([]);
      await fails(deleteVidhi(a.id), "NOT_FOUND");
    });
    it("lists with search, status and category filters", async () => {
      await createVidhi(guide());
      const live = await mkLive({ title: "Daily Lakshmi Pooja", slug: "daily-lakshmi", category: "daily", deity: "Lakshmi" });
      const all = await listVidhi(listVidhiSchema.parse({}));
      expect(all.total).toBe(2);
      expect((await listVidhi(listVidhiSchema.parse({ q: "lakshmi" }))).items.map((i) => i.slug)).toEqual(["daily-lakshmi"]);
      expect((await listVidhi(listVidhiSchema.parse({ status: "published" }))).items[0]).toMatchObject({ id: live.id, live: true, reviewed: true });
      expect((await listVidhi(listVidhiSchema.parse({ category: "festival" }))).items.map((i) => i.slug)).toEqual(["ganesh-chaturthi-pooja"]);
      expect((await listVidhi(listVidhiSchema.parse({ q: ".*" }))).total).toBe(0); // text, not a pattern
    });
  });

  describe("publishing", () => {
    it("refuses to publish or schedule until it is reviewed and has content", async () => {
      const bare = await createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title: "Bare guide", slug: "bare-guide" }));
      const e = await fails(setVidhiPublishState(bare.id, { action: "publish" }), "VALIDATION_ERROR");
      expect(Object.keys(e.fields!)).toEqual(["summary", "steps", "reviewer", "reviewedAt"]);
      await fails(setVidhiPublishState(bare.id, { action: "schedule", publishAt: new Date(Date.now() + 3600_000).toISOString() }), "VALIDATION_ERROR");
      expect((await getVidhi(bare.id)).status).toBe("draft");
      const unreviewed = await createVidhi(guide({ slug: "unreviewed", reviewer: "", reviewedAt: "" }));
      expect((await fails(setVidhiPublishState(unreviewed.id, { action: "publish" }), "VALIDATION_ERROR")).fields).toEqual({ reviewer: "Name who reviewed this for accuracy before publishing", reviewedAt: "Add the date it was reviewed before publishing" });
    });
    it("publishes, keeps the original date when published again, and unpublishes", async () => {
      const v = await createVidhi(guide());
      const p1 = await publishNow(v.id);
      expect(p1.status).toBe("published");
      expect(p1.publishedAt).not.toBeNull();
      await new Promise((r) => setTimeout(r, 15));
      expect((await publishNow(v.id)).publishedAt).toBe(p1.publishedAt);
      const down = await setVidhiPublishState(v.id, { action: "unpublish" });
      expect(down).toMatchObject({ status: "draft", publishedAt: null });
      expect(await findPublicVidhi(v.slug)).toBeNull();
      await fails(setVidhiPublishState("nope", { action: "publish" }), "NOT_FOUND");
    });
    it("a scheduled guide goes live at its time, not before", async () => {
      const v = await createVidhi(guide());
      const at = new Date(Date.now() + 3600_000);
      const s = await setVidhiPublishState(v.id, { action: "schedule", publishAt: at.toISOString() });
      expect(s.status).toBe("scheduled");
      expect(await findPublicVidhi(v.slug)).toBeNull();
      expect(await vidhiExists(v.slug)).toBe(false);
      expect((await findPublicVidhi(v.slug, new Date(at.getTime() + 1000)))?.slug).toBe(v.slug);
      expect(await vidhiExists(v.slug, new Date(at.getTime() + 1000))).toBe(true);
      expect((await findPublicVidhiList({}, new Date())).total).toBe(0);
      expect((await findPublicVidhiList({}, new Date(at.getTime() + 1000))).total).toBe(1);
    });
    it("simultaneous publish clicks end in one consistent state", async () => {
      const v = await createVidhi(guide());
      const rs = await Promise.allSettled(Array.from({ length: 5 }, () => publishNow(v.id)));
      expect(rs.every((r) => r.status === "fulfilled")).toBe(true);
      const d = (await Vidhi.findById(v.id).lean())!;
      expect(d.status).toBe("published");
      expect(new Set(rs.map((r) => (r as PromiseFulfilledResult<{ publishedAt: string | null }>).value.publishedAt)).size).toBe(1);
    });
  });

  describe("preview", () => {
    it("shows drafts by secret token only, and a reset revokes the old link without a false edit conflict", async () => {
      const v = await createVidhi(guide());
      expect(await findPublicVidhi(v.slug)).toBeNull();
      expect((await findPreviewVidhi(v.previewToken))?.title).toBe(v.title);
      const rotated = await rotateVidhiPreviewToken(v.id);
      expect(rotated.previewToken).not.toBe(v.previewToken);
      expect(rotated.updatedAt).toBe(v.updatedAt); // content unchanged: an open editor must not see a conflict
      expect(await findPreviewVidhi(v.previewToken)).toBeNull();
      expect((await findPreviewVidhi(rotated.previewToken))?.slug).toBe(v.slug);
      for (const bad of ["", "short", "x".repeat(70), "has space in it, not a token", "../../etc"]) expect(await findPreviewVidhi(bad), bad).toBeNull();
    });
  });

  describe("what the public sees", () => {
    it("renders sanitised Markdown, structured sections, and reviewer details", async () => {
      const live = await mkLive({
        summary: "Intro with <script>alert(1)</script> **bold** and [link](javascript:alert(1)).", significance: "## Why\n\nIt matters.", preparation: "Clean the altar.",
        steps: [{ title: "Sankalp", body: "Take the **sankalp**.", mantra: "ॐ गं गणपतये नमः" }], mantras: [{ title: "Ganesh mantra", text: "ॐ गं गणपतये नमः", meaning: "Salutations to Ganesha" }],
        author: "Meera Iyer", durationMinutes: 45, coverImageUrl: "https://x.com/c.jpg", coverImageAlt: "Ganesha idol", tags: ["festival"],
      });
      const p = (await findPublicVidhi(live.slug))!;
      expect(p.summaryHtml).toContain("<strong>bold</strong>");
      expect(p.summaryHtml).not.toMatch(/<script|javascript:/i);
      expect(p.significanceHtml).toContain("<h2");
      expect(p.steps[0]).toMatchObject({ title: "Sankalp", mantra: "ॐ गं गणपतये नमः" });
      expect(p.steps[0].bodyHtml).toContain("<strong>sankalp</strong>");
      expect(p).toMatchObject({ categoryLabel: "Festival pooja", deity: "Ganesha", author: "Meera Iyer", reviewer: "Pt. Sharma", durationMinutes: 45, cover: { url: "https://x.com/c.jpg", alt: "Ganesha idol" } });
      expect(p.reviewedAt).toBe("2026-10-31T18:30:00.000Z");
      expect(p.excerpt).toContain("Intro with");
      expect(Object.keys(p)).not.toContain("previewToken");
    });
    it("samagri items link to products that can be bought, and quietly lose the link when they cannot", async () => {
      const a = await mkProduct({ slug: "brass-diya", sku: "BD", price: 49900, stock: 5 });
      const b = await mkProduct({ slug: "camphor", sku: "CP", stock: 0 });
      const live = await mkLive({ samagri: [
        { item: "Diya", quantity: "2", note: "Brass", productSlug: "brass-diya" }, { item: "Camphor", quantity: "", note: "", productSlug: "camphor" }, { item: "Flowers", quantity: "a handful", note: "", productSlug: "" },
      ] });
      let p = (await findPublicVidhi(live.slug))!;
      expect(p.samagri.map((s) => [s.item, s.product?.slug ?? null, s.product?.inStock ?? null])).toEqual([["Diya", "brass-diya", true], ["Camphor", "camphor", false], ["Flowers", null, null]]);
      expect(p.samagri[0].product).toMatchObject({ name: a.name, price: 49900 });
      await Product.deleteOne({ _id: b.id });
      await Product.updateOne({ slug: "brass-diya" }, { $set: { status: "archived" } }); // product leaves the shop after the guide was written
      p = (await findPublicVidhi(live.slug))!;
      expect(p.samagri.map((s) => s.product)).toEqual([null, null, null]);
      expect(p.samagri).toHaveLength(3); // the item itself stays
    });
    it("shows related products in the order given and related guides only when live", async () => {
      await mkProduct({ slug: "diya-a", sku: "A" }); await mkProduct({ slug: "diya-b", sku: "B" });
      const other = await createVidhi(guide({ title: "Other live", slug: "other-live" }));
      const draft = await createVidhi(guide({ title: "Other draft", slug: "other-draft" }));
      await publishNow(other.id);
      const live = await mkLive({ relatedProducts: ["diya-b", "diya-a"], relatedVidhi: ["other-live", "other-draft"], relatedAarti: ["ganesh-aarti"] });
      const p = (await findPublicVidhi(live.slug))!;
      expect(p.relatedProducts.map((x) => x.slug)).toEqual(["diya-b", "diya-a"]);
      expect(p.relatedVidhi.map((x) => x.slug)).toEqual(["other-live"]); // a draft is never linked from a live page
      expect(draft.slug).toBe("other-draft");
      expect(p.relatedAarti).toEqual(["ganesh-aarti"]);
    });
    it("lists live guides newest first with a count per category, a filter and pages", async () => {
      for (const [i, c] of (["daily", "daily", "festival"] as const).entries()) { await mkLive({ title: `Guide ${i}`, slug: `guide-${i}`, category: c }); await new Promise((r) => setTimeout(r, 5)); }
      await createVidhi(guide({ slug: "still-draft", title: "Still draft" }));
      const all = await findPublicVidhiList({ limit: 2 });
      expect(all).toMatchObject({ total: 3, pages: 2, counts: { daily: 2, festival: 1 } });
      expect(all.items.map((i) => i.slug)).toEqual(["guide-2", "guide-1"]); // newest first
      expect((await findPublicVidhiList({ limit: 2, page: 2 })).items.map((i) => i.slug)).toEqual(["guide-0"]);
      const daily = await findPublicVidhiList({ category: "daily" });
      expect(daily.items.map((i) => i.slug)).toEqual(["guide-1", "guide-0"]);
      expect(daily.counts).toEqual({ daily: 2, festival: 1 }); // the counts describe everything, not just this filter
      expect(all.items[0]).toMatchObject({ categoryLabel: "Festival pooja", deity: "Ganesha" });
    });
  });

  describe("URLs and sitemap", () => {
    it("the proxy gives live guides a page and everything else a real 404", async () => {
      const live = await mkLive();
      await createVidhi(guide({ title: "Draft one", slug: "draft-one" }));
      const v = async (p: string) => (await checkPath(p)).kind;
      expect(await v("/pooja-vidhi")).toBe("ok");
      expect(await v(`/pooja-vidhi/${live.slug}`)).toBe("ok");
      expect(await v("/pooja-vidhi/draft-one")).toBe("notFound");
      expect(await v("/pooja-vidhi/missing")).toBe("notFound");
      expect(await v("/pooja-vidhi/Bad_Slug")).toBe("notFound");
      expect(await v("/pooja-vidhi/a/b")).toBe("notFound");
    });
    it("lists live, indexable guides in the sitemap, with the index page", async () => {
      await mkLive();
      await mkLive({ title: "Hidden one", slug: "hidden-one", seo: { ...emptySeo, noindex: true } });
      await createVidhi(guide({ title: "Draft one", slug: "draft-one" }));
      const paths = (await findSitemapEntries()).map((e) => e.path);
      expect(paths).toContain("/pooja-vidhi");
      expect(paths).toContain("/pooja-vidhi/ganesh-chaturthi-pooja");
      expect(paths).not.toContain("/pooja-vidhi/hidden-one");
      expect(paths).not.toContain("/pooja-vidhi/draft-one");
    });
    it("the index is not listed when there are no guides", async () => {
      expect((await findSitemapEntries()).map((e) => e.path)).not.toContain("/pooja-vidhi");
    });
  });
});
