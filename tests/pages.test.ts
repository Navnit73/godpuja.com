import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { Page } from "@/server/models/Page";
import { renderMarkdown } from "@/server/markdown";
import {
  createPage, deletePage, findPreviewPage, findPublicPage, findPublicPosts, getPage, isLive, listPages, rotatePreviewToken,
  setPublishState, updatePage,
} from "@/server/services/pages";
import { ApiError } from "@/server/api";
import { can } from "@/server/auth/permissions";
import { slugify, validateSlug } from "@/lib/slug";
import { emptySeo, listPagesSchema, pageInputSchema, publishSchema, sectionSchema, updatePageSchema, type PageInput } from "@/lib/validation/pages";

const base = (over: Partial<PageInput> = {}): PageInput => ({
  title: "About Us", slug: "about", description: "", seo: { ...emptySeo }, sections: [], ...over,
});
const rich = (markdown: string, enabled = true) => ({ id: "r" + Math.random().toString(36).slice(2, 8), type: "richtext" as const, enabled, data: { markdown } });
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
};

describe("markdown sanitizer", () => {
  const attacks: [string, string[]][] = [
    ["<script>alert(1)</script>hi", ["<script"]],
    ["[x](javascript:alert(1))", ["javascript:"]],
    ["![x](javascript:alert(1))", ["javascript:"]],
    ['<img src=x onerror="alert(1)">', ["onerror"]],
    ['<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', ["data:"]],
    ["<iframe src='https://evil.com'></iframe>", ["<iframe"]],
    ['<a href="//evil.com">x</a>', ['href="//']],
    ["<style>body{display:none}</style>", ["<style"]],
    ['<svg onload=alert(1)>', ["<svg", "onload"]],
    ["<div style='x'>y</div>", ["style="]],
    ["[x](vbscript:msgbox(1))", ["vbscript:"]],
    ['<a href="&#106;avascript:alert(1)">x</a>', ["javascript:", "&#106;"]],
    ['<a href="java\tscript:alert(1)">x</a>', ["script:alert"]],
    ['<a href="/\\evil.com">x</a>', ['href="/\\']],
    ['<a href=" javascript:alert(1)">x</a>', ["javascript:"]],
  ];
  it.each(attacks)("neutralises %j", (input, banned) => {
    const out = renderMarkdown(input).toLowerCase();
    for (const b of banned) expect(out).not.toContain(b);
  });
  it("keeps normal markdown, hardens external links, demotes h1, lazy-loads images", () => {
    const out = renderMarkdown("# Title\n\n**bold** [ext](https://example.com) [int](/about)\n\n![alt](https://example.com/a.png)");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).not.toContain("<h1");
    expect(out).toContain("<h2");
    expect(out).toMatch(/href="https:\/\/example\.com"[^>]*rel="noopener noreferrer"/);
    expect(out).toContain('href="/about"');
    expect(out).not.toMatch(/href="\/about"[^>]*target=/);
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('referrerpolicy="no-referrer"'); // images must not leak preview URLs via Referer
  });
});

describe("slugs", () => {
  it("slugifies", () => {
    expect(slugify("  Graha Shanti Puja! ")).toBe("graha-shanti-puja");
    expect(slugify("Café Menü")).toBe("cafe-menu");
  });
  it.each(["about", "services/graha-shanti", "a1/b2/c3"])("accepts %s", (s) => expect(validateSlug(s)).toBeNull());
  it.each(["", "About", "a b", "a--b", "-a", "a-", "a//b", "a/b/c/d", "../x", "a/../b", "admin", "api/x", "login", "sitemap.xml", "a%2Fb", "x.html"])(
    "rejects %j", (s) => expect(validateSlug(s)).not.toBeNull());
});

describe("validation", () => {
  it("accepts a valid page and normalises slug case/whitespace", () => {
    expect(pageInputSchema.parse(base({ slug: " About " as string })).slug).toBe("about");
  });
  it("rejects reserved/invalid slugs and bad titles", () => {
    expect(pageInputSchema.safeParse(base({ slug: "admin" })).success).toBe(false);
    expect(pageInputSchema.safeParse(base({ title: "x" })).success).toBe(false);
  });
  it("rejects javascript: and non-http URLs in image, cta, canonical, og image", () => {
    const sec = (data: object) => ({ id: "i1", type: "imageText", enabled: true,
      data: { heading: "", markdown: "", imageUrl: "", imageAlt: "", imagePosition: "left", ctaLabel: "", ctaUrl: "", ...data } });
    expect(sectionSchema.safeParse(sec({ imageUrl: "javascript:alert(1)", imageAlt: "a" })).success).toBe(false);
    expect(sectionSchema.safeParse(sec({ imageUrl: "data:image/png;base64,AAA", imageAlt: "a" })).success).toBe(false);
    expect(sectionSchema.safeParse(sec({ ctaLabel: "Go", ctaUrl: "javascript:alert(1)" })).success).toBe(false);
    expect(sectionSchema.safeParse(sec({ ctaLabel: "Go", ctaUrl: "//evil.com" })).success).toBe(false);
    expect(sectionSchema.safeParse(sec({ ctaLabel: "Go", ctaUrl: "/contact" })).success).toBe(true);
    expect(sectionSchema.safeParse(sec({ ctaLabel: "Go", ctaUrl: "https://example.com/x" })).success).toBe(true);
    expect(pageInputSchema.safeParse(base({ seo: { ...emptySeo, canonical: "javascript:1" } })).success).toBe(false);
    expect(pageInputSchema.safeParse(base({ seo: { ...emptySeo, ogImage: "ftp://x.com/a.png" } })).success).toBe(false);
  });
  it("requires alt text with an image and a link with a button label", () => {
    const d = { heading: "", markdown: "", imageUrl: "https://x.com/a.png", imageAlt: "", imagePosition: "left", ctaLabel: "", ctaUrl: "" };
    expect(sectionSchema.safeParse({ id: "a", type: "imageText", enabled: true, data: d }).success).toBe(false);
    expect(sectionSchema.safeParse({ id: "a", type: "imageText", enabled: true, data: { ...d, imageAlt: "ok", ctaLabel: "Go" } }).success).toBe(false);
  });
  it("rejects unknown section types and >50 sections", () => {
    expect(sectionSchema.safeParse({ id: "a", type: "script", enabled: true, data: {} }).success).toBe(false);
    expect(pageInputSchema.safeParse(base({ sections: Array.from({ length: 51 }, () => rich("x")) })).success).toBe(false);
  });
  it("schedule requires a future ISO time", () => {
    expect(publishSchema.safeParse({ action: "schedule", publishAt: "2000-01-01T00:00:00Z" }).success).toBe(false);
    expect(publishSchema.safeParse({ action: "schedule", publishAt: "tomorrow" }).success).toBe(false);
    expect(publishSchema.safeParse({ action: "schedule", publishAt: new Date(Date.now() + 3600_000).toISOString() }).success).toBe(true);
    expect(publishSchema.safeParse({ action: "publish" }).success).toBe(true);
    expect(publishSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
  it("rejects duplicate section ids", () => {
    const a = rich("a"); const b = { ...rich("b"), id: a.id };
    expect(pageInputSchema.safeParse(base({ sections: [a, b] })).success).toBe(false);
  });
  it("update schema requires baseUpdatedAt and strips status / previewToken (no mass assignment)", () => {
    expect(updatePageSchema.safeParse(base()).success).toBe(false);
    const parsed = updatePageSchema.parse({ ...base(), baseUpdatedAt: new Date().toISOString(), status: "published", previewToken: "x".repeat(32), _id: "1" });
    for (const k of ["status", "previewToken", "_id"]) expect(k in parsed).toBe(false);
  });
  it("blog posts and guides live under their prefix; plain pages may not use it; cover needs alt text", () => {
    const ok = (o: Partial<PageInput>) => pageInputSchema.safeParse(base(o)).success;
    expect(ok({ kind: "blog", slug: "blog/diwali-tips" })).toBe(true);
    expect(ok({ kind: "guide", slug: "guides/how-to/aarti" })).toBe(true);
    expect(ok({ kind: "blog", slug: "diwali-tips" })).toBe(false);
    expect(ok({ kind: "blog", slug: "blog" })).toBe(false);
    expect(ok({ kind: "guide", slug: "blog/x" })).toBe(false);
    expect(ok({ slug: "blog/x" })).toBe(false); // kind omitted = page
    expect(ok({ kind: "page", slug: "guides" })).toBe(false);
    expect(ok({ kind: "blog", slug: "blog/x", coverImageUrl: "https://x.com/a.png" })).toBe(false);
    expect(ok({ kind: "blog", slug: "blog/x", coverImageUrl: "https://x.com/a.png", coverImageAlt: "Diya" })).toBe(true);
    expect(ok({ kind: "blog", slug: "blog/x", coverImageUrl: "javascript:alert(1)", coverImageAlt: "x" })).toBe(false);
    expect(updatePageSchema.safeParse({ ...base({ kind: "blog", slug: "about" }), baseUpdatedAt: new Date().toISOString() }).success).toBe(false);
  });
  it("list query bounded", () => {
    expect(listPagesSchema.safeParse({ limit: "999" }).success).toBe(false);
    expect(listPagesSchema.safeParse({ status: "weird" }).success).toBe(false);
  });
});

describe("pages service (godpuja_test)", () => {
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Page.syncIndexes();
  });
  beforeEach(async () => { await Page.deleteMany({}); });
  afterAll(async () => { await Page.deleteMany({}); await mongoose.disconnect(); });

  it("creates drafts with a preview token; duplicate slug -> CONFLICT with field error", async () => {
    const p = await createPage(base());
    expect(p.status).toBe("draft");
    expect(p.previewToken.length).toBeGreaterThanOrEqual(30);
    const err = await createPage(base()).catch((e) => e);
    expect(err.code).toBe("CONFLICT");
    expect(err.fields).toEqual({ slug: "Already in use" });
  });

  it("drafts are not public; publish makes them public; unpublish hides again", async () => {
    const p = await createPage(base({ sections: [rich("Hello **world**")] }));
    expect(await findPublicPage("about")).toBeNull();
    await setPublishState(p.id, { action: "publish" });
    const pub = await findPublicPage("about");
    expect(pub?.title).toBe("About Us");
    expect(pub?.sections[0]).toMatchObject({ type: "richtext", html: expect.stringContaining("<strong>world</strong>") });
    await setPublishState(p.id, { action: "unpublish" });
    expect(await findPublicPage("about")).toBeNull();
    expect((await getPage(p.id)).publishedAt).toBeNull();
  });

  it("detects concurrent edits: stale baseUpdatedAt -> CONFLICT, nothing overwritten", async () => {
    const p = await createPage(base({ title: "Original" }));
    const loadedByBoth = p.updatedAt;
    await updatePage(p.id, base({ title: "Editor A" }), loadedByBoth);
    await fails(updatePage(p.id, base({ title: "Editor B" }), loadedByBoth), "CONFLICT");
    expect((await getPage(p.id)).title).toBe("Editor A");
    // after reloading, B can save
    await expect(updatePage(p.id, base({ title: "Editor B" }), (await getPage(p.id)).updatedAt)).resolves.toBeTruthy();
  });

  it("simultaneous saves from the same version: exactly one wins", async () => {
    const p = await createPage(base());
    const r = await Promise.allSettled([
      updatePage(p.id, base({ title: "One" }), p.updatedAt),
      updatePage(p.id, base({ title: "Two" }), p.updatedAt),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("rotating the preview token returns the new page version (so the next save is not a false conflict)", async () => {
    const p = await createPage(base());
    const rotated = await rotatePreviewToken(p.id);
    expect(rotated.previewToken).not.toBe(p.previewToken);
    await expect(updatePage(p.id, base({ title: "After rotate" }), rotated.updatedAt)).resolves.toBeTruthy();
  });

  it("a scheduled page gets publishedAt = its publish time", async () => {
    const p = await createPage(base());
    const at = new Date(Date.now() + 3600_000).toISOString();
    const s = await setPublishState(p.id, { action: "schedule", publishAt: at });
    expect(s.publishedAt).toBe(s.publishAt);
  });

  it("scheduled pages go live only once publishAt has passed", async () => {
    const p = await createPage(base());
    const future = new Date(Date.now() + 3600_000).toISOString();
    const s = await setPublishState(p.id, { action: "schedule", publishAt: future });
    expect(s.status).toBe("scheduled");
    expect(await findPublicPage("about")).toBeNull();
    expect(await findPublicPage("about", new Date(Date.now() + 2 * 3600_000))).not.toBeNull(); // clock moves past publishAt
    await Page.updateOne({ _id: p.id }, { publishAt: new Date(Date.now() - 1000) });
    expect(await findPublicPage("about")).not.toBeNull();
    expect(isLive({ status: "scheduled", publishAt: new Date(Date.now() + 5000) })).toBe(false);
    expect(isLive({ status: "scheduled" })).toBe(false); // scheduled without a time is never live
  });

  it("publishing a scheduled page clears the schedule", async () => {
    const p = await createPage(base());
    await setPublishState(p.id, { action: "schedule", publishAt: new Date(Date.now() + 3600_000).toISOString() });
    const pub = await setPublishState(p.id, { action: "publish" });
    expect(pub).toMatchObject({ status: "published", publishAt: null });
  });

  it("hides disabled sections and sanitizes stored markdown at render time", async () => {
    const p = await createPage(base({ sections: [rich("visible"), rich("hidden", false), rich("<script>alert(1)</script>[x](javascript:alert(1))")] }));
    await setPublishState(p.id, { action: "publish" });
    const pub = await findPublicPage("about");
    expect(pub?.sections).toHaveLength(2);
    const html = JSON.stringify(pub);
    expect(pub?.sections.some((x) => x.type === "richtext" && x.html.includes("hidden"))).toBe(false);
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).not.toMatch(/href\s*=\s*\\?["']?\s*javascript/i); // no executable link (leftover text is inert)
    expect(html).not.toMatch(/<a[^>]*javascript/i);
  });

  it("preview works for drafts by token only; rotating the token revokes the old one", async () => {
    const p = await createPage(base());
    const pv = await findPreviewPage(p.previewToken);
    expect(pv).toMatchObject({ title: "About Us", isPreview: true });
    expect(await findPreviewPage("x".repeat(32))).toBeNull();
    expect(await findPreviewPage("short")).toBeNull();
    expect(await findPreviewPage("../../etc/passwd")).toBeNull();
    const { previewToken } = await rotatePreviewToken(p.id);
    expect(await findPreviewPage(p.previewToken)).toBeNull();
    expect(await findPreviewPage(previewToken)).not.toBeNull();
  });

  it("update changes content, keeps status, reports previous slug; slug clash -> CONFLICT", async () => {
    const a = await createPage(base());
    await createPage(base({ title: "Contact", slug: "contact" }));
    await setPublishState(a.id, { action: "publish" });
    const { page, previousSlug } = await updatePage(a.id, base({ title: "About v2", slug: "about-us" }), (await getPage(a.id)).updatedAt);
    expect(previousSlug).toBe("about");
    expect(page).toMatchObject({ title: "About v2", slug: "about-us", status: "published" });
    expect(await findPublicPage("about")).toBeNull(); // old URL no longer resolves (301s arrive in Stage 10)
    expect(await findPublicPage("about-us")).not.toBeNull();
    await fails(updatePage(a.id, base({ slug: "contact" }), (await getPage(a.id)).updatedAt), "CONFLICT");
  });

  it("delete removes the page; unknown/malformed ids -> NOT_FOUND", async () => {
    const p = await createPage(base());
    expect(await deletePage(p.id)).toEqual({ slug: "about" });
    await fails(getPage(p.id), "NOT_FOUND");
    await fails(deletePage("nope"), "NOT_FOUND");
    await fails(setPublishState(new mongoose.Types.ObjectId().toString(), { action: "publish" }), "NOT_FOUND");
    await fails(updatePage("zzz", base(), new Date().toISOString()), "NOT_FOUND");
    await fails(rotatePreviewToken("zzz"), "NOT_FOUND");
  });

  it("lists with search (regex-safe), status filter and pagination", async () => {
    for (let i = 0; i < 5; i++) await createPage(base({ title: `Page ${i}`, slug: `page-${i}` }));
    const a = await createPage(base({ title: "Dotted", slug: "dotted" }));
    await setPublishState(a.id, { action: "publish" });
    const r = await listPages({ page: 1, limit: 4 });
    expect(r).toMatchObject({ total: 6, pages: 2 });
    expect((await listPages({ page: 1, limit: 50, status: "published" })).items.map((i) => i.slug)).toEqual(["dotted"]);
    expect((await listPages({ page: 1, limit: 50, q: "PAGE-3" })).total).toBe(1);
    expect((await listPages({ page: 1, limit: 50, q: ".*" })).total).toBe(0);
    expect((await listPages({ page: 1, limit: 50, status: "published" })).items[0].live).toBe(true);
  });

  it("kinds: listing filters by kind (legacy docs without kind count as pages); posts list newest first, live only", async () => {
    await createPage(base());
    await Page.collection.insertOne({ title: "Legacy", slug: "legacy", previewToken: "legacy-token-".padEnd(32, "x"), status: "draft", sections: [], createdAt: new Date(), updatedAt: new Date() });
    const b1 = await createPage(base({ kind: "blog", title: "First", slug: "blog/first", description: "One", coverImageUrl: "https://x.com/a.png", coverImageAlt: "Diya" }));
    const b2 = await createPage(base({ kind: "blog", title: "Second", slug: "blog/second" }));
    await createPage(base({ kind: "blog", title: "Draft", slug: "blog/draft" }));
    const g = await createPage(base({ kind: "guide", title: "Guide", slug: "guides/aarti" }));
    expect((await listPages({ page: 1, limit: 50, kind: "page" })).items.map((i) => i.slug).sort()).toEqual(["about", "legacy"]);
    expect((await listPages({ page: 1, limit: 50, kind: "blog" })).total).toBe(3);
    expect((await getPage(b1.id)).kind).toBe("blog");

    await setPublishState(b1.id, { action: "publish" });
    await new Promise((r) => setTimeout(r, 5));
    await setPublishState(b2.id, { action: "publish" });
    await setPublishState(g.id, { action: "publish" });
    const blog = await findPublicPosts("blog");
    expect(blog.items.map((p) => p.slug)).toEqual(["blog/second", "blog/first"]);
    expect(blog.items[1]).toMatchObject({ kind: "blog", excerpt: "One", coverImageUrl: "https://x.com/a.png", coverImageAlt: "Diya" });
    expect((await findPublicPosts("guide")).items.map((p) => p.slug)).toEqual(["guides/aarti"]);
    expect((await findPublicPosts("all", { limit: 2 })).items).toHaveLength(2);
    expect((await findPublicPosts("blog", { page: 2, limit: 1 })).items.map((p) => p.slug)).toEqual(["blog/first"]);
    const pub = await findPublicPage("blog/first");
    expect(pub).toMatchObject({ kind: "blog", coverImageUrl: "https://x.com/a.png", publishedAt: expect.any(String) });
  });

  it("enforces unique slug at the database level (race safety)", async () => {
    const results = await Promise.allSettled([createPage(base()), createPage(base()), createPage(base())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await Page.countDocuments({ slug: "about" })).toBe(1);
  });
});

describe("page permissions", () => {
  it("editor can write and publish; manager and customer cannot", () => {
    expect(can("editor", "pages:write") && can("editor", "pages:publish")).toBe(true);
    expect(can("manager", "pages:read")).toBe(false);
    expect(can("customer", "pages:read")).toBe(false);
    expect(can("admin", "pages:publish")).toBe(true);
  });
});
