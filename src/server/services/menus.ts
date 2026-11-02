import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Menu, type MenuDoc } from "../models/Menu";
import { Page } from "../models/Page";
import { isLive } from "./pages";
import { pageRefs, type CreateMenuInput, type MenuItemInput, type UpdateMenuInput } from "@/lib/validation/menus";

export type AdminMenu = { id: string; key: string; name: string; items: MenuItemInput[]; createdAt: string; updatedAt: string };
export type MenuListItem = { id: string; key: string; name: string; itemCount: number; updatedAt: string };

const toAdmin = (m: MenuDoc): AdminMenu => ({
  id: String(m._id), key: m.key, name: m.name, items: m.items ?? [],
  createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
});
const count = (items: MenuItemInput[]): number => items.reduce((n, i) => n + 1 + count(i.children ?? []), 0);

export async function listMenus(): Promise<MenuListItem[]> {
  await connectDB();
  const rows = await Menu.find().sort({ key: 1 }).lean();
  return rows.map((m) => ({ id: String(m._id), key: m.key, name: m.name, itemCount: count(m.items ?? []), updatedAt: m.updatedAt.toISOString() }));
}

export async function getMenu(id: string): Promise<AdminMenu> {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Menu not found");
  await connectDB();
  const m = await Menu.findById(id).lean();
  if (!m) throw new ApiError("NOT_FOUND", "Menu not found");
  return toAdmin(m);
}

export async function createMenu(input: CreateMenuInput): Promise<AdminMenu> {
  await connectDB();
  try {
    const m = await Menu.create({ key: input.key, name: input.name, items: [] });
    return toAdmin(m.toObject() as MenuDoc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError("CONFLICT", "A menu with this key already exists", { key: "Already in use" });
    throw err;
  }
}

/** Every page link must point at an existing page (draft pages are allowed; they simply stay hidden until live). */
async function assertPagesExist(items: MenuItemInput[]) {
  const refs = pageRefs(items);
  if (!refs.length) return;
  const found = new Set((await Page.find({ _id: { $in: refs } }).select("_id").lean()).map((p) => String(p._id)));
  const missing = refs.filter((r) => !found.has(r));
  if (missing.length) throw new ApiError("VALIDATION_ERROR", "Some linked pages no longer exist. Choose another page.", { items: "A linked page was deleted" });
}

/** Replaces the whole tree (order = array order). Stale `baseUpdatedAt` => 409 instead of overwriting someone else. */
export async function updateMenu(id: string, { baseUpdatedAt, name, items }: UpdateMenuInput) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Menu not found");
  await connectDB();
  await assertPagesExist(items as MenuItemInput[]);
  const updated = await Menu.findOneAndUpdate(
    { _id: id, updatedAt: new Date(baseUpdatedAt) },
    { $set: { name, items } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) {
    if (!(await Menu.exists({ _id: id }))) throw new ApiError("NOT_FOUND", "Menu not found");
    throw new ApiError("CONFLICT", "This menu was changed by someone else. Reload to see their changes before saving.");
  }
  return toAdmin(updated);
}

/** Pages offered in the link picker. Capped; the editor says so when truncated. */
export async function listLinkablePages(limit = 200) {
  await connectDB();
  const rows = await Page.find().select("title slug status publishAt").sort({ title: 1 }).limit(limit).lean();
  return rows.map((p) => ({ id: String(p._id), title: p.title, slug: p.slug, live: isLive(p) }));
}

// ---------- Public (storefront) reads ----------

export type PublicMenuItem = {
  id: string; label: string; href: string; external: boolean; newTab: boolean;
  showOnDesktop: boolean; showOnMobile: boolean; children: PublicMenuItem[];
};
export type PublicMenu = { key: string; items: PublicMenuItem[] };

const CHILDREN_LIMIT = 30;

/**
 * Resolves a stored tree for visitors: drops disabled items and links to pages that are not live (a hidden parent
 * hides its whole subtree) and turns page references into current URLs, so renaming a slug never breaks the menu.
 * One batched page query for the whole tree.
 */
export async function findPublicMenu(key: string, now = new Date()): Promise<PublicMenu | null> {
  await connectDB();
  const m = await Menu.findOne({ key }).lean();
  if (!m) return null;
  const items = m.items ?? [];
  const refs = pageRefs(items);
  const pages = refs.length ? await Page.find({ _id: { $in: refs } }).select("slug status publishAt").lean() : [];
  const slugs = new Map(pages.filter((p) => isLive(p, now)).map((p) => [String(p._id), p.slug]));

  const resolve = (list: MenuItemInput[]): PublicMenuItem[] => {
    const out: PublicMenuItem[] = [];
    for (const i of list.slice(0, CHILDREN_LIMIT)) {
      if (!i.enabled) continue;
      let href: string;
      if (i.type === "page") {
        const slug = i.ref ? slugs.get(i.ref) : undefined;
        if (slug === undefined) continue;
        href = slug === "home" ? "/" : `/${slug}`;
      } else {
        href = i.url ?? "";
        if (!href) continue;
      }
      const external = /^https?:\/\//i.test(href);
      out.push({
        id: i.id, label: i.label, href, external, newTab: i.openInNewTab,
        showOnDesktop: i.showOnDesktop, showOnMobile: i.showOnMobile, children: resolve(i.children ?? []),
      });
    }
    return out;
  };
  return { key: m.key, items: resolve(items) };
}
