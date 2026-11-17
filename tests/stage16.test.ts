// Stage 16 — Aarti & Mantras with rights-controlled audio (PRD v1.1 §9).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { Devotional } from "@/server/models/Devotional";
import { Redirect } from "@/server/models/Redirect";
import { Vidhi } from "@/server/models/Vidhi";
import { can } from "@/server/auth/permissions";
import { _resetRouteCache, checkPath } from "@/server/route-check";
import {
  countAudioNeedingAttention, createDevotional, deleteDevotional, findPreviewDevotional, findPublicDevotional, findPublicDevotionalList, getDevotional, listDevotionals,
  rotateDevotionalPreviewToken, setDevotionalPublishState, updateDevotional,
} from "@/server/services/devotional";
import { createVidhi, findPublicVidhi, setVidhiPublishState } from "@/server/services/vidhi";
import { findSitemapEntries } from "@/server/services/sitemap";
import { validateSlug } from "@/lib/slug";
import { audioPlayable, audioStatus, publishProblems } from "@/lib/devotional-rules";
import { emptyVidhi, vidhiInputSchema } from "@/lib/validation/vidhi";
import {
  devotionalHref, devotionalInputSchema, emptyDevotional, listDevotionalSchema, publicDevotionalSchema, updateDevotionalSchema, type DevotionalInput,
} from "@/lib/validation/devotional";

const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};
const REVIEWED = { reviewer: "Pt. Sharma", reviewedAt: "2026-11-01T00:00:00+05:30" };
const DAY = 24 * 3600 * 1000;
const rights = (over: Partial<DevotionalInput["rights"]> = {}): DevotionalInput["rights"] => ({ source: "Recorded for GodPuja", licence: "original", reference: "", expiresAt: "", withdrawn: false, ...over });
const item = (over: Partial<DevotionalInput> = {}): DevotionalInput => devotionalInputSchema.parse({
  ...emptyDevotional, title: "Ganesh Aarti", slug: "ganesh-aarti", type: "aarti", deity: "Ganesha", language: "hindi", lyrics: "जय गणेश जय गणेश\nजय गणेश देवा", ...REVIEWED, ...over,
});
const withAudio = (r: Partial<DevotionalInput["rights"]> = {}, over: Partial<DevotionalInput> = {}) => item({ audioUrl: "https://cdn.example.com/ganesh.mp3", rights: rights(r), ...over });

// ---------------------------------------------------------------- pure
describe("audio rights rules", () => {
  const now = new Date("2026-11-17T00:00:00Z");
  const url = "https://x.com/a.mp3";
  it("plays only with a complete, unexpired, unwithdrawn rights record", () => {
    expect(audioStatus("", rights(), now)).toBe("none");
    expect(audioStatus(url, rights(), now)).toBe("ok");
    expect(audioStatus(url, rights({ licence: "public-domain" }), now)).toBe("ok");
    expect(audioStatus(url, rights({ source: "" }), now)).toBe("unlicensed");
    expect(audioStatus(url, rights({ licence: "" }), now)).toBe("unlicensed");
    expect(audioStatus(url, rights({ licence: "licensed" }), now)).toBe("unlicensed"); // a licence needs its reference
    expect(audioStatus(url, rights({ licence: "licensed", reference: "AGR-12" }), now)).toBe("ok");
    expect(audioStatus(url, rights({ withdrawn: true }), now)).toBe("withdrawn");
    expect(audioStatus(url, undefined, now)).toBe("unlicensed");
  });
  it("hides audio the moment rights expire, and warns 30 days ahead", () => {
    const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
    expect(audioStatus(url, rights({ expiresAt: at(-1) }), now)).toBe("expired");
    expect(audioStatus(url, rights({ expiresAt: at(0) }), now)).toBe("expired"); // the end instant itself is already too late
    expect(audioStatus(url, rights({ expiresAt: at(10 * DAY) }), now)).toBe("expiring");
    expect(audioStatus(url, rights({ expiresAt: at(31 * DAY) }), now)).toBe("ok");
    expect(audioPlayable("ok") && audioPlayable("expiring")).toBe(true);
    for (const s of ["none", "expired", "withdrawn", "unlicensed"] as const) expect(audioPlayable(s), s).toBe(false);
    expect(audioStatus(url, rights({ withdrawn: true, expiresAt: at(-1) }), now)).toBe("withdrawn");
  });
  it("needs text, a reviewer and a review date to publish", () => {
    expect(publishProblems({ lyrics: "x", reviewer: "A", reviewedAt: new Date() })).toEqual({});
    expect(Object.keys(publishProblems({}))).toEqual(["lyrics", "reviewer", "reviewedAt"]);
    expect(Object.keys(publishProblems({ lyrics: "  ", reviewer: "A", reviewedAt: new Date() }))).toEqual(["lyrics"]);
  });
});

describe("validation", () => {
  const issue = (o: object) => { const r = devotionalInputSchema.safeParse({ ...emptyDevotional, title: "Title x", slug: "title-x", ...o }); return r.success ? null : r.error.issues[0].path.join("."); };
  it("fills defaults and normalises lists", () => {
    const v = devotionalInputSchema.parse({ ...emptyDevotional, title: "Hanuman Chalisa", slug: "hanuman-chalisa", type: "chalisa", relatedAarti: ["Ganesh-Aarti", "ganesh-aarti", ""], tags: [" Tuesday ", "tuesday"] });
    expect(v.relatedAarti).toEqual(["ganesh-aarti"]);
    expect(v.tags).toEqual(["tuesday"]);
    expect(v).toMatchObject({ language: "sanskrit", audioUrl: "", audioDurationSeconds: null, rights: { withdrawn: false, expiresAt: "" } });
  });
  it("rejects bad slugs, types, languages and URLs", () => {
    expect(issue({})).toBeNull();
    for (const o of [{ slug: "" }, { slug: "A B" }, { slug: "a/b" }, { type: "bhajan" }, { language: "klingon" }, { title: "x" }, { audioUrl: "javascript:alert(1)" }, { audioUrl: "ftp://x.com/a.mp3" }, { lyrics: "x".repeat(30_001) }, { audioDurationSeconds: 0 }])
      expect(issue(o), JSON.stringify(o)).not.toBeNull();
  });
  it("audio needs its rights recorded before it can be saved", () => {
    const a = "https://x.com/a.mp3";
    expect(issue({ audioUrl: a })).toBe("rights.source");
    expect(issue({ audioUrl: a, rights: rights({ licence: "" }) })).toBe("rights.licence");
    expect(issue({ audioUrl: a, rights: rights({ licence: "licensed" }) })).toBe("rights.reference");
    expect(issue({ audioUrl: a, rights: rights() })).toBeNull();
    expect(issue({ rights: rights({ source: "", licence: "" }) })).toBeNull(); // no audio, no rights needed
  });
  it("review needs a name and a date together; a cover needs a description; no self-links", () => {
    expect(issue({ reviewer: "Sharma" })).toBe("reviewedAt");
    expect(issue({ reviewedAt: "2026-11-01T00:00:00+05:30" })).toBe("reviewer");
    expect(issue({ coverImageUrl: "https://x.com/a.jpg" })).toBe("coverImageAlt");
    expect(issue({ relatedAarti: ["title-x"] })).toBe("relatedAarti");
  });
  it("parses list filters and public queries leniently", () => {
    expect(listDevotionalSchema.parse({}).limit).toBe(20);
    expect(listDevotionalSchema.safeParse({ type: "nope" }).success).toBe(false);
    expect(publicDevotionalSchema.parse({ type: "stotra", language: "hindi", page: "2" })).toMatchObject({ type: "stotra", language: "hindi", page: 2 });
    expect(publicDevotionalSchema.safeParse({ language: "x" }).success).toBe(false);
    expect(updateDevotionalSchema.safeParse({ ...emptyDevotional, title: "Title x", slug: "title-x" }).success).toBe(false);
  });
  it("aarti live under /aarti, everything else under /mantras; both prefixes are reserved", () => {
    expect(devotionalHref("aarti", "x")).toBe("/aarti/x");
    for (const t of ["mantra", "chalisa", "stotra"]) expect(devotionalHref(t, "x")).toBe("/mantras/x");
    expect(validateSlug("aarti")).toMatch(/reserved/);
    expect(validateSlug("mantras/anything")).toMatch(/reserved/);
    expect(validateSlug("aarti-sangrah")).toBeNull();
  });
  it("is available to content roles only", () => {
    for (const r of ["content_manager", "admin", "superadmin"] as const) for (const p of ["devotional:read", "devotional:write", "devotional:publish"] as const) expect(can(r, p), `${r} ${p}`).toBe(true);
    for (const r of ["store_manager", "support_agent", "booking_manager", "temple_operator", "customer"] as const) expect(can(r, "devotional:read") || can(r, "devotional:write") || can(r, "devotional:publish"), r).toBe(false);
  });
});

// ---------------------------------------------------------------- database
describe("devotional service", () => {
  const wipe = () => Promise.all([Devotional, Vidhi, Redirect].map((m) => (m as typeof Devotional).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Devotional, Vidhi, Redirect].map((m) => (m as typeof Devotional).syncIndexes()));
  });
  beforeEach(async () => { await wipe(); _resetRouteCache(); });
  afterAll(async () => { await wipe(); await mongoose.disconnect(); });

  const publishNow = (id: string) => setDevotionalPublishState(id, { action: "publish" });
  const mkLive = async (over: Partial<DevotionalInput> = {}) => publishNow((await createDevotional(item(over))).id);
  const AARTI = ["aarti"] as const;
  const MANTRA = ["mantra", "chalisa", "stotra"] as const;

  describe("create and edit", () => {
    it("creates a draft with a preview token and clears redirects at its URL", async () => {
      await Redirect.create({ from: "/aarti/ganesh-aarti", to: "/elsewhere", status: 301 } as never).catch(() => {});
      const v = await createDevotional(item());
      expect(v).toMatchObject({ status: "draft", slug: "ganesh-aarti", audioStatus: "none", language: "hindi" });
      expect(v.previewToken.length).toBeGreaterThan(20);
      expect(await Redirect.countDocuments({ from: "/aarti/ganesh-aarti" })).toBe(0);
    });
    it("refuses a duplicate slug even across types", async () => {
      await createDevotional(item());
      const e = await fails(createDevotional(item({ type: "mantra" })), "CONFLICT");
      expect(e.fields).toMatchObject({ slug: expect.any(String) });
    });
    it("stores rights and reports the audio status to the admin", async () => {
      const v = await createDevotional(withAudio({ licence: "licensed", reference: "AGR-1", expiresAt: new Date(Date.now() + 5 * DAY).toISOString() }));
      expect(v.audioStatus).toBe("expiring");
      expect(v.rights).toMatchObject({ source: "Recorded for GodPuja", licence: "licensed", reference: "AGR-1", withdrawn: false });
      expect((await getDevotional(v.id)).rights.expiresAt).toBe(v.rights.expiresAt);
    });
    it("refuses a stale save, and a non-publisher cannot edit or delete a published item", async () => {
      const v = await createDevotional(item());
      const { item: saved } = await updateDevotional(v.id, item({ title: "Ganesh Aarti 2" }), v.updatedAt);
      expect(saved.title).toBe("Ganesh Aarti 2");
      await fails(updateDevotional(v.id, item({ title: "Late" }), v.updatedAt), "CONFLICT");
      const live = await publishNow(v.id);
      await fails(updateDevotional(v.id, item(), live.updatedAt, { draftOnly: true }), "FORBIDDEN");
      await fails(deleteDevotional(v.id, { draftOnly: true }), "FORBIDDEN");
      await updateDevotional(v.id, item({ title: "By publisher" }), live.updatedAt);
    });
    it("rejects links to things that do not exist", async () => {
      const e = await fails(createDevotional(item({ relatedAarti: ["nope"], relatedVidhi: ["no-guide"], relatedProducts: ["no-product"] })), "VALIDATION_ERROR");
      expect(Object.keys(e.fields ?? {}).sort()).toEqual(["relatedAarti", "relatedProducts", "relatedVidhi"]);
    });
    it("renaming the slug or changing the type keeps the old URL working and updates links to it", async () => {
      const a = await mkLive();
      const b = await createDevotional(item({ title: "Other", slug: "other-aarti", relatedAarti: ["ganesh-aarti"] }));
      const { item: moved } = await updateDevotional(a.id, item({ slug: "ganesh-ji-aarti" }), a.updatedAt);
      expect(moved.slug).toBe("ganesh-ji-aarti");
      expect((await Redirect.findOne({ from: "/aarti/ganesh-aarti" }).lean())?.to).toBe("/aarti/ganesh-ji-aarti");
      expect((await getDevotional(b.id)).relatedAarti).toEqual(["ganesh-ji-aarti"]);
      const again = await getDevotional(a.id);
      await updateDevotional(a.id, item({ slug: "ganesh-ji-aarti", type: "stotra" }), again.updatedAt);
      expect((await Redirect.findOne({ from: "/aarti/ganesh-ji-aarti" }).lean())?.to).toBe("/mantras/ganesh-ji-aarti");
    });
    it("deleting removes the item from other pages' related lists and drops redirects to it", async () => {
      const a = await mkLive();
      const b = await createDevotional(item({ title: "Other", slug: "other-aarti", relatedAarti: ["ganesh-aarti"] }));
      const guide = await createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title: "Guide x", slug: "guide-x", relatedAarti: ["ganesh-aarti"] }));
      await deleteDevotional(a.id);
      expect((await getDevotional(b.id)).relatedAarti).toEqual([]);
      expect((await Vidhi.findById(guide.id).lean())?.relatedAarti).toEqual([]);
      await fails(getDevotional(a.id), "NOT_FOUND");
    });
  });

  describe("publishing", () => {
    it("needs text, a reviewer and a review date; unpublish returns to draft", async () => {
      const v = await createDevotional(item({ lyrics: "", reviewer: "", reviewedAt: "" }));
      const e = await fails(publishNow(v.id), "VALIDATION_ERROR");
      expect(Object.keys(e.fields ?? {})).toEqual(["lyrics", "reviewer", "reviewedAt"]);
      const ok = await createDevotional(item({ slug: "ok-aarti", title: "Ok aarti" }));
      expect((await publishNow(ok.id)).status).toBe("published");
      expect((await setDevotionalPublishState(ok.id, { action: "unpublish" })).status).toBe("draft");
    });
    it("a scheduled item is public only after its time", async () => {
      const v = await createDevotional(item());
      const at = new Date(Date.now() + 3600_000).toISOString();
      await setDevotionalPublishState(v.id, { action: "schedule", publishAt: at });
      expect(await findPublicDevotional("ganesh-aarti", AARTI)).toBeNull();
      expect((await findPublicDevotional("ganesh-aarti", AARTI, new Date(Date.now() + 2 * 3600_000)))?.slug).toBe("ganesh-aarti");
    });
    it("preview works for drafts by token, and a reset token revokes the old link", async () => {
      const v = await createDevotional(item());
      expect(await findPublicDevotional("ganesh-aarti", AARTI)).toBeNull();
      expect((await findPreviewDevotional(v.previewToken))?.title).toBe("Ganesh Aarti");
      const r = await rotateDevotionalPreviewToken(v.id);
      expect(await findPreviewDevotional(v.previewToken)).toBeNull();
      expect(await findPreviewDevotional(r.previewToken)).not.toBeNull();
      expect(await findPreviewDevotional("short")).toBeNull();
    });
  });

  describe("public pages and audio rights", () => {
    it("serves an item only under the URL prefix for its type", async () => {
      await mkLive(); await mkLive({ title: "Hanuman Chalisa", slug: "hanuman-chalisa", type: "chalisa", deity: "Hanuman" });
      expect((await findPublicDevotional("ganesh-aarti", AARTI))?.typeLabel).toBe("Aarti");
      expect(await findPublicDevotional("ganesh-aarti", MANTRA)).toBeNull();
      expect((await findPublicDevotional("hanuman-chalisa", MANTRA))?.typeLabel).toBe("Chalisa");
      expect(await findPublicDevotional("hanuman-chalisa", AARTI)).toBeNull();
    });
    it("offers audio with its credit while rights are valid", async () => {
      await mkLive(withAudio({}, {}));
      const p = (await findPublicDevotional("ganesh-aarti", AARTI))!;
      expect(p.audio).toEqual({ url: "https://cdn.example.com/ganesh.mp3", durationSeconds: null, credit: "Recorded for GodPuja" });
      expect(p.hasAudio).toBe(true);
    });
    it("hides audio once rights expire, without any edit or deploy", async () => {
      await mkLive(withAudio({ expiresAt: new Date(Date.now() + 2 * DAY).toISOString() }));
      expect((await findPublicDevotional("ganesh-aarti", AARTI))?.audio).not.toBeNull();
      const later = new Date(Date.now() + 3 * DAY);
      const p = (await findPublicDevotional("ganesh-aarti", AARTI, later))!;
      expect(p.audio).toBeNull();
      expect(p.hasAudio).toBe(false);
      expect(p.lyrics).toContain("जय गणेश"); // the text stays
      expect((await findPublicDevotionalList({ types: AARTI }, later)).items[0].hasAudio).toBe(false);
    });
    it("hides withdrawn audio at once, and never offers audio whose rights record is incomplete", async () => {
      const v = await createDevotional(withAudio());
      await publishNow(v.id);
      expect((await findPublicDevotional("ganesh-aarti", AARTI))?.audio).not.toBeNull();
      const cur = await getDevotional(v.id);
      await updateDevotional(v.id, withAudio({ withdrawn: true }), cur.updatedAt);
      expect((await findPublicDevotional("ganesh-aarti", AARTI))?.audio).toBeNull();
      // Data written outside the API (an import or an old record) with no rights is not playable either.
      await Devotional.updateOne({ _id: v.id }, { $set: { "rights.withdrawn": false, "rights.licence": "" } });
      expect((await findPublicDevotional("ganesh-aarti", AARTI))?.audio).toBeNull();
      expect((await findPreviewDevotional(v.previewToken))?.audio).toBeNull(); // previews follow the same rule
    });
    it("never leaks rights details beyond the credit line", async () => {
      await mkLive(withAudio({ licence: "licensed", reference: "SECRET-AGREEMENT-9" }));
      expect(JSON.stringify(await findPublicDevotional("ganesh-aarti", AARTI))).not.toContain("SECRET-AGREEMENT-9");
    });
    it("counts recordings needing attention for the admin", async () => {
      await createDevotional(withAudio({ expiresAt: new Date(Date.now() + 5 * DAY).toISOString() }));
      await createDevotional(withAudio({ withdrawn: true }, { slug: "b-aarti", title: "B aarti" }));
      await createDevotional(withAudio({}, { slug: "c-aarti", title: "C aarti" }));
      await createDevotional(item({ slug: "d-aarti", title: "D aarti", rights: rights({ expiresAt: new Date(Date.now() - DAY).toISOString() }) })); // no audio: not counted
      expect(await countAudioNeedingAttention()).toBe(2);
    });
    it("resolves related items: live only, in the order given; draft and missing ones are dropped", async () => {
      await mkLive({ title: "Aarti A", slug: "a-aarti" });
      await createDevotional(item({ title: "B draft", slug: "b-draft" }));
      await mkLive({ title: "Aarti C", slug: "c-aarti" });
      const g = await createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title: "Guide y", slug: "guide-y", summary: "x", steps: [{ title: "", body: "do" }], ...REVIEWED }));
      await setVidhiPublishState(g.id, { action: "publish" });
      const main = await mkLive({ slug: "main-aarti", title: "Main", relatedAarti: ["c-aarti", "b-draft", "a-aarti"], relatedVidhi: ["guide-y"] });
      const p = (await findPublicDevotional(main.slug, AARTI))!;
      expect(p.related.map((r) => r.slug)).toEqual(["c-aarti", "a-aarti"]);
      expect(p.relatedVidhi).toEqual([{ slug: "guide-y", title: "Guide y" }]);
    });
    it("Pooja Vidhi pages now show live related aarti, and links are verified when saved", async () => {
      await mkLive({ title: "Live", slug: "live-aarti" });
      await createDevotional(item({ title: "Draft one", slug: "draft-aarti" }));
      const e = await fails(createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title: "Guide z", slug: "guide-z", relatedAarti: ["missing-aarti"] })), "VALIDATION_ERROR");
      expect(e.fields).toMatchObject({ relatedAarti: expect.stringContaining("missing-aarti") });
      const g = await createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title: "Guide z", slug: "guide-z", summary: "x", steps: [{ title: "", body: "do" }], ...REVIEWED, relatedAarti: ["draft-aarti", "live-aarti"] }));
      await setVidhiPublishState(g.id, { action: "publish" });
      expect((await findPublicVidhi("guide-z"))!.relatedAarti.map((a) => a.slug)).toEqual(["live-aarti"]);
    });
  });

  describe("browsing", () => {
    it("filters by type, deity, language and search; counts and facets cover the whole section", async () => {
      await mkLive({ title: "Ganesh Aarti", slug: "ganesh-aarti", deity: "Ganesha", language: "hindi" });
      await mkLive({ title: "Lakshmi Aarti", slug: "lakshmi-aarti", deity: "Lakshmi", language: "hindi" });
      await mkLive({ title: "Gayatri Mantra", slug: "gayatri-mantra", type: "mantra", deity: "Gayatri", language: "sanskrit", tags: ["morning"] });
      await mkLive({ title: "Hanuman Chalisa", slug: "hanuman-chalisa", type: "chalisa", deity: "Hanuman", language: "hindi" });
      await createDevotional(item({ title: "Hidden draft", slug: "hidden-draft" }));
      const aarti = await findPublicDevotionalList({ types: AARTI });
      expect(aarti.items.map((i) => i.slug).sort()).toEqual(["ganesh-aarti", "lakshmi-aarti"]);
      expect(aarti.deities).toEqual(["Ganesha", "Lakshmi"]);
      const m = await findPublicDevotionalList({ types: MANTRA });
      expect(m.total).toBe(2);
      expect(m.typeCounts).toEqual({ mantra: 1, chalisa: 1 });
      expect(m.languages.sort()).toEqual(["hindi", "sanskrit"]);
      expect((await findPublicDevotionalList({ types: MANTRA, type: "chalisa" })).items.map((i) => i.slug)).toEqual(["hanuman-chalisa"]);
      expect((await findPublicDevotionalList({ types: MANTRA, type: "aarti" })).total).toBe(2); // a type outside the section is ignored
      expect((await findPublicDevotionalList({ types: MANTRA, language: "sanskrit" })).items.map((i) => i.slug)).toEqual(["gayatri-mantra"]);
      expect((await findPublicDevotionalList({ types: AARTI, deity: "ganesha" })).items.map((i) => i.slug)).toEqual(["ganesh-aarti"]);
      expect((await findPublicDevotionalList({ types: MANTRA, q: "morning" })).items.map((i) => i.slug)).toEqual(["gayatri-mantra"]);
      expect((await findPublicDevotionalList({ types: AARTI, q: ".*" })).total).toBe(0); // search text is never a pattern
    });
    it("lists newest first with pages", async () => {
      for (const n of [1, 2, 3]) { await mkLive({ title: `Aarti ${n}`, slug: `aarti-${n}` }); await new Promise((r) => setTimeout(r, 5)); }
      const p1 = await findPublicDevotionalList({ types: AARTI, limit: 2 });
      expect(p1.items.map((i) => i.slug)).toEqual(["aarti-3", "aarti-2"]);
      expect(p1.pages).toBe(2);
      expect((await findPublicDevotionalList({ types: AARTI, limit: 2, page: 2 })).items.map((i) => i.slug)).toEqual(["aarti-1"]);
    });
    it("admin list filters by status, type and text", async () => {
      await mkLive(); await createDevotional(item({ title: "Gayatri", slug: "gayatri", type: "mantra", deity: "Surya" }));
      expect((await listDevotionals(listDevotionalSchema.parse({ status: "draft" }))).items.map((i) => i.slug)).toEqual(["gayatri"]);
      expect((await listDevotionals(listDevotionalSchema.parse({ type: "aarti" }))).items.map((i) => i.live)).toEqual([true]);
      expect((await listDevotionals(listDevotionalSchema.parse({ q: "surya" }))).total).toBe(1);
    });
  });

  describe("routing and sitemap", () => {
    it("gives real 404s for unknown, draft and wrong-prefix URLs", async () => {
      await mkLive(); await mkLive({ title: "Gayatri", slug: "gayatri", type: "mantra" }); await createDevotional(item({ title: "Draft", slug: "draft-one" }));
      expect((await checkPath("/aarti")).kind).toBe("ok");
      expect((await checkPath("/mantras")).kind).toBe("ok");
      expect((await checkPath("/aarti/ganesh-aarti")).kind).toBe("ok");
      expect((await checkPath("/mantras/gayatri")).kind).toBe("ok");
      for (const p of ["/aarti/gayatri", "/mantras/ganesh-aarti", "/aarti/draft-one", "/aarti/nope", "/aarti/a/b", "/aarti/Bad_Slug"]) expect((await checkPath(p)).kind, p).toBe("notFound");
    });
    it("lists live, indexable items and both index pages in the sitemap", async () => {
      await mkLive(); await mkLive({ title: "Gayatri", slug: "gayatri", type: "mantra" });
      await mkLive({ title: "Hidden", slug: "hidden", seo: { title: "", description: "", canonical: "", ogImage: "", noindex: true } });
      await createDevotional(item({ title: "Draft", slug: "draft-one" }));
      const paths = (await findSitemapEntries()).map((e) => e.path);
      expect(paths).toEqual(expect.arrayContaining(["/aarti", "/mantras", "/aarti/ganesh-aarti", "/mantras/gayatri"]));
      expect(paths).not.toContain("/aarti/hidden");
      expect(paths).not.toContain("/aarti/draft-one");
    });
    it("omits an index page from the sitemap while it has nothing live", async () => {
      await mkLive();
      const paths = (await findSitemapEntries()).map((e) => e.path);
      expect(paths).toContain("/aarti");
      expect(paths).not.toContain("/mantras");
    });
  });
});
