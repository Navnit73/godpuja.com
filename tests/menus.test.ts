import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { Menu } from "@/server/models/Menu";
import { Page } from "@/server/models/Page";
import { createMenu, findPublicMenu, getMenu, listLinkablePages, listMenus, updateMenu } from "@/server/services/menus";
import { createPage, setPublishState } from "@/server/services/pages";
import { ApiError } from "@/server/api";
import { can } from "@/server/auth/permissions";
import { add, canIndent, canOutdent, flatten, indent, locate, move, newItem, outdent, remove, reorder, update } from "@/lib/menu-tree";
import { createMenuSchema, updateMenuSchema, type MenuItemInput } from "@/lib/validation/menus";
import { emptySeo } from "@/lib/validation/pages";

const item = (id: string, over: Partial<MenuItemInput> = {}): MenuItemInput => ({
  ...newItem(id), label: id, type: "external", url: "/" + id, ...over,
});
const save = (items: MenuItemInput[], baseUpdatedAt = new Date().toISOString(), name = "Header") => ({ name, items, baseUpdatedAt });
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
};

describe("menu validation", () => {
  it("accepts a 3-level tree and rejects a 4th level", () => {
    const ok = [item("a", { children: [item("b", { children: [item("c")] })] })];
    expect(updateMenuSchema.safeParse(save(ok)).success).toBe(true);
    const deep = [item("a", { children: [item("b", { children: [item("c", { children: [item("d")] })] })] })];
    expect(updateMenuSchema.safeParse(save(deep)).success).toBe(false);
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "//evil.com", "ftp://x.com", "", "/a b", "/\\evil"])("rejects external url %j", (url) => {
    expect(updateMenuSchema.safeParse(save([item("a", { url })])).success).toBe(false);
  });
  it.each(["/about", "https://example.com/x", "/a?b=1#c"])("accepts external url %j", (url) => {
    expect(updateMenuSchema.safeParse(save([item("a", { url })])).success).toBe(true);
  });
  it("requires a page ref for page links, a label, and rejects catalog types until Stage 6", () => {
    expect(updateMenuSchema.safeParse(save([item("a", { type: "page", ref: undefined })])).success).toBe(false);
    expect(updateMenuSchema.safeParse(save([item("a", { type: "page", ref: "not-an-id" })])).success).toBe(false);
    expect(updateMenuSchema.safeParse(save([item("a", { type: "page", ref: "a".repeat(24) })])).success).toBe(true);
    expect(updateMenuSchema.safeParse(save([item("a", { label: "  " })])).success).toBe(false);
    expect(updateMenuSchema.safeParse(save([{ ...item("a"), type: "product" as never }])).success).toBe(false);
  });
  it("rejects duplicate ids, >100 items, missing baseUpdatedAt; strips unknown keys", () => {
    expect(updateMenuSchema.safeParse(save([item("a"), item("a")])).success).toBe(false);
    const many = Array.from({ length: 4 }, (_, g) => item("g" + g, { children: Array.from({ length: 30 }, (_, i) => item(`g${g}c${i}`)) }));
    expect(updateMenuSchema.safeParse(save(many)).success).toBe(false); // 4 + 120 > 100
    expect(updateMenuSchema.safeParse({ name: "x1", items: [] }).success).toBe(false);
    const parsed = updateMenuSchema.parse(save([{ ...item("a"), evil: 1 } as MenuItemInput]));
    expect("evil" in parsed.items[0]).toBe(false);
  });
  it("validates menu keys", () => {
    expect(createMenuSchema.parse({ key: " Header ", name: "Header" }).key).toBe("header");
    for (const key of ["a b", "-x", "x_y", "../x", ""]) expect(createMenuSchema.safeParse({ key, name: "Header" }).success).toBe(false);
  });
});

describe("menu tree helpers", () => {
  const tree = () => [item("a"), item("b", { children: [item("b1"), item("b2")] }), item("c")];
  it("moves among siblings and stops at the ends", () => {
    expect(move(tree(), "c", -1).map((i) => i.id)).toEqual(["a", "c", "b"]);
    expect(move(tree(), "a", -1).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(move(tree(), "b2", -1)[1].children.map((i) => i.id)).toEqual(["b2", "b1"]);
  });
  it("reorders only within the same parent", () => {
    expect(reorder(tree(), "c", "a").map((i) => i.id)).toEqual(["c", "a", "b"]);
    expect(reorder(tree(), "b1", "a")).toEqual(tree());
  });
  it("indents under the previous sibling and outdents back after the parent", () => {
    const t = indent(tree(), "c");
    expect(t.map((i) => i.id)).toEqual(["a", "b"]);
    expect(t[1].children.map((i) => i.id)).toEqual(["b1", "b2", "c"]);
    expect(outdent(t, "c").map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(canIndent(tree(), "a")).toBe(false); // first item has no previous sibling
    expect(canOutdent(tree(), "a")).toBe(false);
  });
  it("never allows nesting past three levels", () => {
    const t = [item("a", { children: [item("b")] }), item("c", { children: [item("d")] })];
    expect(canIndent(t, "c")).toBe(true); // c(+d) under a => depth 3
    const deeper = indent(t, "c");
    expect(locate(deeper, "d")?.depth).toBe(3);
    expect(canIndent(deeper, "d")).toBe(false);
    expect(add(deeper, "d", item("x"))).toEqual(deeper);
    const heavy = [item("a", { children: [item("b")] }), item("c", { children: [item("d", { children: [item("e")] })] })];
    expect(canIndent(heavy, "c")).toBe(false); // would become level 4
  });
  it("updates and removes by id at any depth without mutating the input", () => {
    const t = tree();
    const snapshot = JSON.stringify(t);
    expect(flatten(update(t, "b2", { label: "X" })).find((i) => i.id === "b2")?.label).toBe("X");
    expect(flatten(remove(t, "b")).map((i) => i.id)).toEqual(["a", "c"]);
    expect(JSON.stringify(t)).toBe(snapshot);
  });
});

describe("menus service (godpuja_test)", () => {
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Menu.syncIndexes();
    await Page.syncIndexes();
  });
  beforeEach(async () => { await Menu.deleteMany({}); await Page.deleteMany({}); });
  afterAll(async () => { await Menu.deleteMany({}); await Page.deleteMany({}); await mongoose.disconnect(); });

  const mkPage = (slug: string) => createPage({ title: slug.toUpperCase(), slug, description: "", seo: { ...emptySeo }, sections: [] });

  it("creates, lists and rejects duplicate keys", async () => {
    await createMenu({ key: "header", name: "Header" });
    await fails(createMenu({ key: "header", name: "Again" }), "CONFLICT");
    const list = await listMenus();
    expect(list).toHaveLength(1);
    expect(list[0].itemCount).toBe(0);
    await fails(getMenu("nope"), "NOT_FOUND");
  });

  it("saves the whole tree preserving order and nesting", async () => {
    const m = await createMenu({ key: "header", name: "Header" });
    const items = [item("b"), item("a", { children: [item("a2"), item("a1")] })];
    const saved = await updateMenu(m.id, updateMenuSchema.parse(save(items, m.updatedAt)));
    expect(saved.items.map((i) => i.id)).toEqual(["b", "a"]);
    expect(saved.items[1].children.map((i) => i.id)).toEqual(["a2", "a1"]);
    expect((await listMenus())[0].itemCount).toBe(4);
  });

  it("detects stale saves (optimistic concurrency) and unknown menus", async () => {
    const m = await createMenu({ key: "header", name: "Header" });
    await updateMenu(m.id, updateMenuSchema.parse(save([item("a")], m.updatedAt)));
    await fails(updateMenu(m.id, updateMenuSchema.parse(save([item("z")], m.updatedAt))), "CONFLICT");
    await fails(updateMenu("a".repeat(24), updateMenuSchema.parse(save([], m.updatedAt))), "NOT_FOUND");
  });

  it("two concurrent saves from the same version: exactly one wins", async () => {
    const m = await createMenu({ key: "header", name: "Header" });
    const r = await Promise.allSettled([
      updateMenu(m.id, updateMenuSchema.parse(save([item("x")], m.updatedAt))),
      updateMenu(m.id, updateMenuSchema.parse(save([item("y")], m.updatedAt))),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("rejects links to pages that do not exist", async () => {
    const m = await createMenu({ key: "header", name: "Header" });
    const ghost = item("a", { type: "page", ref: new mongoose.Types.ObjectId().toHexString() });
    await fails(updateMenu(m.id, updateMenuSchema.parse(save([ghost], m.updatedAt))), "VALIDATION_ERROR");
  });

  it("public menu: resolves page slugs, hides drafts, disabled items and whole subtrees", async () => {
    const live = await mkPage("about"); await setPublishState(live.id, { action: "publish" });
    const home = await mkPage("home"); await setPublishState(home.id, { action: "publish" });
    const draft = await mkPage("secret");
    const m = await createMenu({ key: "header", name: "Header" });
    const items = [
      item("home", { type: "page", ref: home.id }),
      item("about", { type: "page", ref: live.id }),
      item("hidden-draft", { type: "page", ref: draft.id, children: [item("kid")] }),
      item("off", { enabled: false }),
      item("shop", { url: "https://shop.example.com", openInNewTab: true, children: [item("shop-off", { enabled: false }), item("shop-on")] }),
    ];
    await updateMenu(m.id, updateMenuSchema.parse(save(items, m.updatedAt)));
    const pub = await findPublicMenu("header");
    expect(pub!.items.map((i) => [i.id, i.href])).toEqual([["home", "/"], ["about", "/about"], ["shop", "https://shop.example.com"]]);
    expect(pub!.items[2]).toMatchObject({ external: true, newTab: true });
    expect(pub!.items[2].children.map((c) => c.id)).toEqual(["shop-on"]);
    expect(JSON.stringify(pub)).not.toContain("secret");
    expect(await findPublicMenu("missing")).toBeNull();
  });

  it("public menu follows page changes: slug rename updates the link, unpublish removes it, scheduled goes live", async () => {
    const p = await mkPage("about"); await setPublishState(p.id, { action: "publish" });
    const m = await createMenu({ key: "header", name: "Header" });
    await updateMenu(m.id, updateMenuSchema.parse(save([item("a", { type: "page", ref: p.id })], m.updatedAt)));
    await Page.updateOne({ _id: p.id }, { $set: { slug: "about-us" } });
    expect((await findPublicMenu("header"))!.items[0].href).toBe("/about-us");
    await setPublishState(p.id, { action: "unpublish" });
    expect((await findPublicMenu("header"))!.items).toHaveLength(0);
    await Page.updateOne({ _id: p.id }, { $set: { status: "scheduled", publishAt: new Date(Date.now() + 60_000) } });
    expect((await findPublicMenu("header"))!.items).toHaveLength(0);
    expect((await findPublicMenu("header", new Date(Date.now() + 120_000)))!.items).toHaveLength(1);
  });

  it("link picker is capped but always includes pages that are already linked", async () => {
    const a = await mkPage("aaa"); await mkPage("bbb"); const z = await mkPage("zzz");
    const plain = await listLinkablePages([], 2);
    expect(plain.pages.map((p) => p.slug)).toEqual(["aaa", "bbb"]); // sorted by title
    expect(plain.truncated).toBe(true);
    const withRef = await listLinkablePages([z.id, a.id, "not-an-id"], 2);
    expect(withRef.pages.map((p) => p.slug).sort()).toEqual(["aaa", "bbb", "zzz"]);
    expect((await listLinkablePages([], 10)).truncated).toBe(false);
  });

  it("deleted pages disappear from the public menu", async () => {
    const p = await mkPage("gone"); await setPublishState(p.id, { action: "publish" });
    const m = await createMenu({ key: "header", name: "Header" });
    await updateMenu(m.id, updateMenuSchema.parse(save([item("a", { type: "page", ref: p.id }), item("b")], m.updatedAt)));
    await Page.deleteOne({ _id: p.id });
    expect((await findPublicMenu("header"))!.items.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("menu permissions", () => {
  it("nav:write is for editor/admin/superadmin only", () => {
    expect(can("editor", "nav:write")).toBe(true);
    expect(can("admin", "nav:write")).toBe(true);
    expect(can("manager", "nav:write")).toBe(false);
    expect(can("customer", "nav:write")).toBe(false);
  });
});
