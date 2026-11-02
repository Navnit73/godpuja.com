import type mongoose from "mongoose";
import { connectDB } from "../db";
import { Category } from "../models/Category";

/**
 * In-process snapshot of the (small) category table for hot public reads: product listings, product detail and
 * homepage rails need category paths, names and visibility on every request, and each extra DB round trip costs as
 * much as the query itself. One read serves all of them for a few seconds.
 *
 * Freshness: cleared immediately by every category write on this instance (services/categories.ts); other instances
 * catch up within TTL_MS. Paths that must be exact (cart validation, checkout) read with `fresh: true`.
 */
export type CategoryRow = { _id: mongoose.Types.ObjectId; name: string; path: string; parent: mongoose.Types.ObjectId | null; isActive: boolean };
export type CategorySnapshot = {
  rows: CategoryRow[];
  byId: Map<string, CategoryRow>;
  byPath: Map<string, CategoryRow>;
  /** id -> path, for every category (visibility is decided separately). */
  catPath: Map<string, string>;
  /** Categories hidden because they or an ancestor are inactive. */
  hidden: mongoose.Types.ObjectId[];
  hiddenIds: Set<string>;
};

const TTL_MS = process.env.NODE_ENV === "test" ? 0 : 10_000; // tests write categories directly via models
let cached: { at: number; value: Promise<CategorySnapshot> } | null = null;

async function load(): Promise<CategorySnapshot> {
  await connectDB();
  const rows = (await Category.find().select("name path parent isActive").lean()).map((r) => ({
    _id: r._id, name: r.name, path: r.path, parent: (r.parent as mongoose.Types.ObjectId | null) ?? null, isActive: r.isActive !== false,
  }));
  const inactive = rows.filter((r) => !r.isActive).map((r) => r.path);
  const hidden = rows.filter((r) => inactive.some((p) => r.path === p || r.path.startsWith(p + "/"))).map((r) => r._id);
  return {
    rows,
    byId: new Map(rows.map((r) => [String(r._id), r])),
    byPath: new Map(rows.map((r) => [r.path, r])),
    catPath: new Map(rows.map((r) => [String(r._id), r.path])),
    hidden,
    hiddenIds: new Set(hidden.map(String)),
  };
}

export function categorySnapshot({ fresh = false, ttlMs = TTL_MS } = {}): Promise<CategorySnapshot> {
  const now = Date.now();
  if (!fresh && cached && now - cached.at < ttlMs) return cached.value;
  const value = load();
  cached = { at: now, value };
  value.catch(() => { if (cached?.value === value) cached = null; }); // never cache a failure
  return value;
}

export function invalidateCategorySnapshot() {
  cached = null;
}

/** Ids of the category at `path` and all its descendants, if it and every ancestor are active; otherwise null. */
export function activeSubtree(s: CategorySnapshot, path: string): mongoose.Types.ObjectId[] | null {
  const root = s.byPath.get(path);
  if (!root || s.hiddenIds.has(String(root._id))) return null;
  return s.rows.filter((r) => (r.path === path || r.path.startsWith(path + "/")) && !s.hiddenIds.has(String(r._id))).map((r) => r._id);
}
