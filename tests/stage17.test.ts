// Stage 17 — Phase 1 release: pillar tiles, content highlights, coming-soon pages, analytics settings, legal pages.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import mongoose from "mongoose";

import { connectDB } from "@/server/db";
import { Devotional } from "@/server/models/Devotional";
import { Homepage } from "@/server/models/Homepage";
import { Settings } from "@/server/models/Settings";
import { Vidhi } from "@/server/models/Vidhi";
import { _resetRouteCache, checkPath } from "@/server/route-check";
import { createDevotional, setDevotionalPublishState } from "@/server/services/devotional";
import { findPublicHomepage, updateHomepage } from "@/server/services/homepage";
import { findSiteSettings, getSeoSettings, updateSeoSettings } from "@/server/services/settings";
import { createVidhi, setVidhiPublishState } from "@/server/services/vidhi";
import { COMING_SOON, PILLARS } from "@/lib/pillars";
import { validateSlug } from "@/lib/slug";
import { defaultData, homeSectionSchema, type HomeSection, type SectionType } from "@/lib/validation/homepage";
import { emptyDevotional, devotionalInputSchema } from "@/lib/validation/devotional";
import { emptyVidhi, vidhiInputSchema } from "@/lib/validation/vidhi";
import { defaultSeoSettings, seoSettingsSchema } from "@/lib/validation/seo";
import { LEGAL_PAGES } from "../scripts/legal/pages";

let n = 0;
const sec = <T extends SectionType>(type: T, data: Record<string, unknown> = {}, enabled = true) =>
  ({ id: `s${++n}`, type, enabled, data: { ...structuredClone(defaultData[type]), ...data } }) as unknown as HomeSection;
const REVIEWED = { reviewer: "Pt. Sharma", reviewedAt: "2026-11-01T00:00:00+05:30" };

describe("pillars", () => {
  it("lists the five pillars and Donate; a pillar that is not live has a coming-soon page", () => {
    expect(PILLARS.map((p) => p.key)).toEqual(["shop", "temples", "book", "vidhi", "aarti", "donate"]);
    for (const p of PILLARS.filter((x) => !x.live)) expect(Object.values(COMING_SOON).some((c) => `/${c.path}` === p.href), p.key).toBe(true);
    for (const p of PILLARS.filter((x) => x.live)) expect(Object.values(COMING_SOON).some((c) => `/${c.path}` === p.href), p.key).toBe(false);
  });
  it("coming-soon URLs are reserved, so no CMS page can take them before the real page ships", () => {
    for (const c of Object.values(COMING_SOON)) expect(validateSlug(c.path), c.path).toMatch(/reserved/);
  });
  it("every coming-soon page exists in the app", () => {
    for (const c of Object.values(COMING_SOON)) expect(fs.existsSync(`src/app/(store)/${c.path}/page.tsx`), c.path).toBe(true);
  });
});

describe("homepage section validation", () => {
  const ok = (s: HomeSection) => homeSectionSchema.safeParse(s).success;
  it("accepts the new sections and enforces their limits", () => {
    expect(ok(sec("pillars"))).toBe(true);
    expect(ok(sec("vidhiHighlights"))).toBe(true);
    expect(ok(sec("vidhiHighlights", { limit: 13 }))).toBe(false);
    expect(ok(sec("devotionalHighlights"))).toBe(true);
    expect(ok(sec("devotionalHighlights", { kind: "mantras", limit: 12 }))).toBe(true);
    expect(ok(sec("devotionalHighlights", { kind: "bhajan" }))).toBe(false);
    expect(ok(sec("devotionalHighlights", { limit: 0 }))).toBe(false);
  });
});

describe("analytics and Search Console settings", () => {
  const base = { ...defaultSeoSettings };
  it("accepts a GA4 id (normalised to upper case) or nothing, and rejects other shapes", () => {
    expect(seoSettingsSchema.parse({ ...base, gaMeasurementId: "g-abc123xyz4" }).gaMeasurementId).toBe("G-ABC123XYZ4");
    expect(seoSettingsSchema.parse({ ...base, gaMeasurementId: "" }).gaMeasurementId).toBe("");
    for (const bad of ["UA-12345-1", "G-", "G-ABC 123", "<script>", "G-ABC123XYZ4'); alert(1);//"]) expect(seoSettingsSchema.safeParse({ ...base, gaMeasurementId: bad }).success, bad).toBe(false);
  });
  it("accepts a bare verification code but not a pasted tag or script", () => {
    expect(seoSettingsSchema.safeParse({ ...base, searchConsoleVerification: "abcDEF123_-abcDEF123_-xyz" }).success).toBe(true);
    for (const bad of ['<meta name="google-site-verification" content="abc">', "short", "has space in it that is long enough"]) expect(seoSettingsSchema.safeParse({ ...base, searchConsoleVerification: bad }).success, bad).toBe(false);
  });
  it("older settings without these fields still load, and the ids are stored", async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Settings.deleteMany({});
    await Settings.create({ key: "main", siteName: "GodPuja" });
    const before = await getSeoSettings();
    expect(before).toMatchObject({ gaMeasurementId: "", searchConsoleVerification: "" });
    const { updatedAt, ...rest } = before;
    const saved = await updateSeoSettings({ ...rest, gaMeasurementId: "G-ABC123XYZ4", searchConsoleVerification: "abcDEF123_-abcDEF123_-xyz", baseUpdatedAt: updatedAt });
    expect(saved.gaMeasurementId).toBe("G-ABC123XYZ4");
    expect((await findSiteSettings()).searchConsoleVerification).toBe("abcDEF123_-abcDEF123_-xyz");
    await Settings.deleteMany({});
  });
});

describe("analytics is consent-gated and the CSP allows only Google's endpoints", () => {
  const src = fs.readFileSync("src/components/store/Analytics.tsx", "utf8");
  const cfg = fs.readFileSync("next.config.ts", "utf8");
  it("loads gtag only after consent is granted, and offers reject as prominently as accept", () => {
    expect(src).toMatch(/choice === "granted" && \(/);
    expect(src.indexOf("googletagmanager.com/gtag/js")).toBeGreaterThan(src.indexOf('choice === "granted"'));
    expect(src).toContain("Reject analytics");
    expect(src).toContain("Accept analytics");
    expect(src).toContain("anonymize_ip");
  });
  it("CSP lists only Google Tag Manager and Analytics hosts and permits https audio", () => {
    expect(cfg).toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com");
    expect(cfg).toContain("https://*.google-analytics.com");
    expect(cfg).toContain("media-src 'self' https:");
    expect(cfg).not.toMatch(/script-src[^\n]*\*\s/); // no wildcard script source
  });
});

describe("legal pages", () => {
  it("ships a cookie policy and a data-retention page whose links resolve to each other", () => {
    expect(LEGAL_PAGES.map((p) => p.slug)).toEqual(["cookies", "data-retention"]);
    const cookies = LEGAL_PAGES[0].markdown, retention = LEGAL_PAGES[1].markdown;
    expect(cookies).toContain("/data-retention");
    expect(retention).toContain("/cookies");
    expect(cookies).toContain("gp_session");
    expect(cookies).toMatch(/Cookie settings/);
    for (const p of LEGAL_PAGES) expect(validateSlug(p.slug), p.slug).toBeNull();
  });
});

describe("homepage highlights (database)", () => {
  const wipe = () => Promise.all([Homepage, Vidhi, Devotional].map((m) => (m as typeof Homepage).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Vidhi, Devotional].map((m) => (m as typeof Vidhi).syncIndexes()));
  });
  beforeEach(async () => { await wipe(); _resetRouteCache(); });
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });

  const dev = async (slug: string, type: "aarti" | "mantra", extra: object = {}) => {
    const d = await createDevotional(devotionalInputSchema.parse({ ...emptyDevotional, title: `Item ${slug}`, slug, type, lyrics: "text", ...REVIEWED, ...extra }));
    return setDevotionalPublishState(d.id, { action: "publish" });
  };
  const guide = async (slug: string) => {
    const v = await createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title: `Guide ${slug}`, slug, summary: "x", steps: [{ title: "", body: "do" }], ...REVIEWED }));
    return setVidhiPublishState(v.id, { action: "publish" });
  };

  it("pillar tiles always show; highlights are hidden while there is nothing live (no empty headings)", async () => {
    await updateHomepage({ baseUpdatedAt: null, sections: [sec("pillars"), sec("vidhiHighlights"), sec("devotionalHighlights")] });
    const home = (await findPublicHomepage())!;
    expect(home.sections.map((s) => s.type)).toEqual(["pillars"]);
  });
  it("shows the newest live guides and items, links to the right index, and respects the limit and kind", async () => {
    await guide("g-1"); await new Promise((r) => setTimeout(r, 5)); await guide("g-2");
    await createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title: "Draft guide", slug: "g-draft" }));
    await dev("a-1", "aarti"); await dev("m-1", "mantra"); await dev("a-2", "aarti");
    await createDevotional(devotionalInputSchema.parse({ ...emptyDevotional, title: "Draft aarti", slug: "a-draft", type: "aarti" }));
    await updateHomepage({ baseUpdatedAt: null, sections: [
      sec("vidhiHighlights", { limit: 1 }), sec("devotionalHighlights", { kind: "aarti" }), sec("devotionalHighlights", { kind: "mantras" }), sec("devotionalHighlights", { kind: "all", limit: 2 }),
    ] });
    const s = (await findPublicHomepage())!.sections as Array<{ type: string; items: { slug: string }[]; viewAll: string }>;
    expect(s[0]).toMatchObject({ type: "vidhiHighlights", viewAll: "/pooja-vidhi" });
    expect(s[0].items.map((i) => i.slug)).toEqual(["g-2"]);
    expect(s[1].items.map((i) => i.slug).sort()).toEqual(["a-1", "a-2"]);
    expect(s[1].viewAll).toBe("/aarti");
    expect(s[2].items.map((i) => i.slug)).toEqual(["m-1"]);
    expect(s[2].viewAll).toBe("/mantras");
    expect(s[3].items).toHaveLength(2);
  });
  it("a disabled highlight section is not shown", async () => {
    await guide("g-1");
    await updateHomepage({ baseUpdatedAt: null, sections: [sec("vidhiHighlights", {}, false)] });
    expect((await findPublicHomepage())!.sections).toEqual([]);
  });
  it("highlight cards show the Audio badge only while the recording's rights are valid", async () => {
    const audio = { audioUrl: "https://cdn.example.com/a.mp3", rights: { source: "GodPuja", licence: "original", reference: "", expiresAt: "", withdrawn: false } };
    await dev("with-audio", "aarti", audio);
    await dev("expired-audio", "aarti", { ...audio, rights: { ...audio.rights, expiresAt: new Date(Date.now() + 1000).toISOString() } });
    await updateHomepage({ baseUpdatedAt: null, sections: [sec("devotionalHighlights", { kind: "aarti", limit: 5 })] });
    const items = ((await findPublicHomepage(new Date(Date.now() + 5000)))!.sections[0] as unknown as { items: { slug: string; hasAudio: boolean }[] }).items;
    expect(Object.fromEntries(items.map((i) => [i.slug, i.hasAudio]))).toEqual({ "with-audio": true, "expired-audio": false });
  });
  it("coming-soon URLs are served (not 404) by the proxy", async () => {
    for (const p of ["/temples", "/book-a-pooja", "/donate"]) expect((await checkPath(p)).kind, p).toBe("ok");
  });
});
