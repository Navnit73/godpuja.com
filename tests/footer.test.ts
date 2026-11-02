import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { Footer } from "@/server/models/Footer";
import { Page } from "@/server/models/Page";
import { Subscriber } from "@/server/models/Subscriber";
import { findPublicFooter, getFooter, subscribe, updateFooter } from "@/server/services/footer";
import { createPage, setPublishState } from "@/server/services/pages";
import { ApiError } from "@/server/api";
import { can } from "@/server/auth/permissions";
import { emptyFooter, footerInputSchema, subscribeSchema, updateFooterSchema, type FooterInput, type FooterLinkInput } from "@/lib/validation/footer";
import { emptySeo } from "@/lib/validation/pages";

const link = (id: string, over: Partial<FooterLinkInput> = {}): FooterLinkInput => ({ id, label: id, type: "external", url: "/" + id, openInNewTab: false, enabled: true, ...over });
const footer = (over: Partial<FooterInput> = {}): FooterInput => ({ ...emptyFooter, ...over });
const col = (id: string, links: FooterLinkInput[], over = {}) => ({ id, heading: id, enabled: true, links, ...over });
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
};

describe("footer validation", () => {
  it("accepts the defaults", () => expect(footerInputSchema.safeParse(emptyFooter).success).toBe(true));
  it.each(["javascript:alert(1)", "//evil.com", "data:text/html,x", ""])("rejects link url %j", (url) => {
    expect(footerInputSchema.safeParse(footer({ legalLinks: [link("a", { url })] })).success).toBe(false);
  });
  it("social links must be https and a known platform", () => {
    const s = (url: string, platform = "facebook") => footerInputSchema.safeParse(footer({ social: [{ id: "s", platform: platform as "facebook", url, enabled: true }] })).success;
    expect(s("https://facebook.com/x")).toBe(true);
    expect(s("http://facebook.com/x")).toBe(false);
    expect(s("javascript:1")).toBe(false);
    expect(s("https://x.com/y", "myspace")).toBe(false);
  });
  it("limits columns/links and requires unique ids and headings", () => {
    expect(footerInputSchema.safeParse(footer({ columns: Array.from({ length: 7 }, (_, i) => col("c" + i, [])) })).success).toBe(false);
    expect(footerInputSchema.safeParse(footer({ columns: [col("c", Array.from({ length: 13 }, (_, i) => link("l" + i)))] })).success).toBe(false);
    expect(footerInputSchema.safeParse(footer({ columns: [col("a", [link("x")]), col("b", [link("x")])] })).success).toBe(false);
    expect(footerInputSchema.safeParse(footer({ columns: [col("a", [], { heading: " " })] })).success).toBe(false);
  });
  it("validates contact email/phone", () => {
    expect(footerInputSchema.safeParse(footer({ contact: { address: "", phone: "+91 98765 43210", email: "a@b.co" } })).success).toBe(true);
    expect(footerInputSchema.safeParse(footer({ contact: { address: "", phone: "call me", email: "" } })).success).toBe(false);
    expect(footerInputSchema.safeParse(footer({ contact: { address: "", phone: "", email: "nope" } })).success).toBe(false);
    expect(footerInputSchema.safeParse(footer({ contact: { address: "", phone: "+", email: "" } })).success).toBe(false);
    expect(footerInputSchema.safeParse(footer({ social: [{ id: "s", platform: "x", url: "https://x.com/" + "a".repeat(2001), enabled: true }] })).success).toBe(false);
  });
  it("update schema needs baseUpdatedAt (null allowed for first save)", () => {
    expect(updateFooterSchema.safeParse(emptyFooter).success).toBe(false);
    expect(updateFooterSchema.safeParse({ ...emptyFooter, baseUpdatedAt: null }).success).toBe(true);
  });
  it("subscribe schema normalises email", () => {
    expect(subscribeSchema.parse({ email: "  A@B.com " }).email).toBe("a@b.com");
    expect(subscribeSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(subscribeSchema.safeParse({ email: "a@b.com", _hp: "x".repeat(5000) }).success).toBe(true); // oversized honeypot is not rejected
  });
});

describe("footer service (godpuja_test)", () => {
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([Footer.syncIndexes(), Subscriber.syncIndexes(), Page.syncIndexes()]);
  });
  beforeEach(async () => { await Promise.all([Footer.deleteMany({}), Subscriber.deleteMany({}), Page.deleteMany({})]); });
  afterAll(async () => { await Promise.all([Footer.deleteMany({}), Subscriber.deleteMany({}), Page.deleteMany({})]); await mongoose.disconnect(); });

  const mkPage = async (slug: string, publish = true) => {
    const p = await createPage({ title: slug, slug, description: "", seo: { ...emptySeo }, sections: [] });
    if (publish) await setPublishState(p.id, { action: "publish" });
    return p;
  };

  it("returns defaults before the first save, then persists; public is null until saved", async () => {
    expect((await getFooter()).updatedAt).toBeNull();
    expect(await findPublicFooter()).toBeNull();
    const saved = await updateFooter({ ...footer({ copyright: "© {year} X" }), baseUpdatedAt: null });
    expect(saved.updatedAt).not.toBeNull();
    expect((await getFooter()).copyright).toBe("© {year} X");
  });

  it("first save is create-only; stale saves get 409; concurrent saves: one wins", async () => {
    const first = await updateFooter({ ...footer(), baseUpdatedAt: null });
    await fails(updateFooter({ ...footer(), baseUpdatedAt: null }), "CONFLICT");
    await updateFooter({ ...footer({ copyright: "b" }), baseUpdatedAt: first.updatedAt });
    await fails(updateFooter({ ...footer({ copyright: "c" }), baseUpdatedAt: first.updatedAt }), "CONFLICT");
    const cur = await getFooter();
    const r = await Promise.allSettled([
      updateFooter({ ...footer({ copyright: "x" }), baseUpdatedAt: cur.updatedAt }),
      updateFooter({ ...footer({ copyright: "y" }), baseUpdatedAt: cur.updatedAt }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("rejects links to pages that do not exist", async () => {
    const ghost = link("g", { type: "page", ref: new mongoose.Types.ObjectId().toHexString() });
    await fails(updateFooter({ ...footer({ legalLinks: [ghost] }), baseUpdatedAt: null }), "VALIDATION_ERROR");
  });

  it("public footer: resolves page links, hides disabled/draft/empty, keeps order, fills {year}", async () => {
    const about = await mkPage("about");
    const draft = await mkPage("secret", false);
    await updateFooter({
      ...footer({
        columns: [
          col("c1", [link("a", { type: "page", ref: about.id }), link("b", { enabled: false }), link("d", { type: "page", ref: draft.id }), link("e", { url: "https://x.com", openInNewTab: true })]),
          col("c2", [link("only-draft", { type: "page", ref: draft.id })]),
          col("c3", [link("z")], { enabled: false }),
        ],
        social: [{ id: "s1", platform: "instagram", url: "https://instagram.com/g", enabled: true }, { id: "s2", platform: "x", url: "https://x.com/g", enabled: false }],
        legalLinks: [link("terms", { url: "/terms" })],
        copyright: "© {year} GodPuja",
      }),
      baseUpdatedAt: null,
    });
    const pub = (await findPublicFooter())!;
    expect(pub.columns.map((c) => c.id)).toEqual(["c1"]);
    expect(pub.columns[0].links.map((l) => [l.id, l.href])).toEqual([["a", "/about"], ["e", "https://x.com"]]);
    expect(pub.columns[0].links[1]).toMatchObject({ external: true, newTab: true });
    expect(pub.social.map((s) => s.id)).toEqual(["s1"]);
    expect(pub.legalLinks.map((l) => l.href)).toEqual(["/terms"]);
    expect(pub.copyright).toBe(`© ${new Date().getFullYear()} GodPuja`);
    expect(JSON.stringify(pub)).not.toContain("secret");
  });

  it("newsletter: stores once, lower-cased, idempotent", async () => {
    await subscribe("a@b.com");
    await subscribe("a@b.com");
    // Many identical simultaneous requests must never surface a duplicate-key error.
    await Promise.all(Array.from({ length: 20 }, () => subscribe("c@d.com")));
    expect(await Subscriber.countDocuments()).toBe(2);
  });
});

describe("footer permissions", () => {
  it("footer:write is for editor/admin/superadmin only", () => {
    expect(can("editor", "footer:write")).toBe(true);
    expect(can("admin", "footer:write")).toBe(true);
    expect(can("manager", "footer:write")).toBe(false);
    expect(can("customer", "footer:write")).toBe(false);
  });
});
