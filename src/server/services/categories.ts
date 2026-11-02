import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Category, type CategoryDoc } from "../models/Category";
import { Product } from "../models/Product";
import { clearRedirectsFrom, dropRedirectsTo, recordRedirects } from "./redirects";
import { MAX_CATEGORY_DEPTH, type CategoryInput, type UpdateCategoryInput } from "@/lib/validation/catalog";

export type AdminCategory = CategoryInput & { id: string; path: string; level: number; createdAt: string; updatedAt: string };
export type CategoryListItem = Pick<AdminCategory, "id" | "name" | "slug" | "path" | "level" | "parent" | "order" | "isActive"> & { productCount: number };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isId = (id: string) => mongoose.isValidObjectId(id);

function toAdmin(c: CategoryDoc): AdminCategory {
  return {
    id: String(c._id), name: c.name, slug: c.slug, parent: c.parent ? String(c.parent) : null, path: c.path, level: c.level,
    description: c.description ?? "", image: { url: c.image?.url ?? "", alt: c.image?.alt ?? "" }, order: c.order ?? 0, isActive: c.isActive !== false,
    seo: { title: c.seo?.title ?? "", description: c.seo?.description ?? "", canonical: c.seo?.canonical ?? "", ogImage: c.seo?.ogImage ?? "", noindex: !!c.seo?.noindex },
    createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  };
}

/**
 * Structural writes (create/move/delete) "touch" the parent nodes they depend on. Two transactions that rely on the
 * same node then write the same document, so MongoDB reports a write conflict and one retries against fresh data;
 * without this, two moves with disjoint write sets (A under B and B under A) could both commit and form a cycle.
 * `timestamps:false` so editors' `baseUpdatedAt` is unaffected.
 */
async function touch(ids: (string | mongoose.Types.ObjectId | null | undefined)[], session: mongoose.ClientSession) {
  const real = ids.filter(Boolean) as (string | mongoose.Types.ObjectId)[];
  if (real.length) await Category.updateMany({ _id: { $in: real } }, { $inc: { treeVersion: 1 } }, { session, timestamps: false });
}

const dupPath = (err: unknown): never => {
  if ((err as { code?: number }).code === 11000) throw new ApiError("CONFLICT", "A category with this URL already exists under that parent", { slug: "Already in use here" });
  throw err;
};

/** Flat list in tree order (by path) with product counts from one aggregation. */
export async function listCategories(): Promise<CategoryListItem[]> {
  await connectDB();
  const [rows, counts] = await Promise.all([
    Category.find().sort({ path: 1 }).lean(),
    Product.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $match: { category: { $ne: null } } }, { $group: { _id: "$category", n: { $sum: 1 } } }]),
  ]);
  const byCat = new Map(counts.map((c) => [String(c._id), c.n]));
  return rows.map((c) => ({
    id: String(c._id), name: c.name, slug: c.slug, path: c.path, level: c.level, parent: c.parent ? String(c.parent) : null,
    order: c.order ?? 0, isActive: c.isActive !== false, productCount: byCat.get(String(c._id)) ?? 0,
  }));
}

export async function getCategory(id: string): Promise<AdminCategory> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Category not found");
  await connectDB();
  const c = await Category.findById(id).lean();
  if (!c) throw new ApiError("NOT_FOUND", "Category not found");
  return toAdmin(c);
}

export async function createCategory(input: CategoryInput) {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    let out!: AdminCategory;
    await session.withTransaction(async () => {
      let p = { path: "", level: 0 };
      if (input.parent) {
        if (!isId(input.parent)) throw new ApiError("VALIDATION_ERROR", "Parent not found", { parent: "Choose an existing category" });
        const found = await Category.findById(input.parent).session(session).select("path level").lean();
        if (!found) throw new ApiError("VALIDATION_ERROR", "Parent not found", { parent: "Choose an existing category" });
        p = found;
      }
      if (p.level + 1 > MAX_CATEGORY_DEPTH) throw new ApiError("VALIDATION_ERROR", `Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep`, { parent: "Too deep" });
      const path = p.path ? `${p.path}/${input.slug}` : input.slug;
      await touch([input.parent], session); // conflicts with a concurrent move/delete of the parent
      const [c] = await Category.create([{ ...input, path, level: p.level + 1 }], { session });
      await clearRedirectsFrom([`/category/${path}`], session);
      out = toAdmin(c.toObject() as CategoryDoc);
    });
    return out;
  } catch (err) {
    return dupPath(err);
  } finally {
    await session.endSession();
  }
}

/**
 * Edit a category. Changing slug or parent re-computes the path and level of the whole subtree and records
 * 301 redirects for every moved URL, all in one transaction. Stale `baseUpdatedAt` => 409.
 */
export async function updateCategory(id: string, { baseUpdatedAt, ...input }: UpdateCategoryInput) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Category not found");
  await connectDB();
  const session = await mongoose.startSession();
  try {
    let result!: AdminCategory;
    await session.withTransaction(async () => {
      const cur = await Category.findById(id).session(session).lean();
      if (!cur) throw new ApiError("NOT_FOUND", "Category not found");
      if (cur.updatedAt.getTime() !== new Date(baseUpdatedAt).getTime()) {
        throw new ApiError("CONFLICT", "This category was changed by someone else. Reload to see their changes before saving.");
      }
      const parent = input.parent ?? null;
      const prefix = new RegExp(`^${escapeRegex(cur.path)}/`);
      const descendants = await Category.find({ path: prefix }).session(session).select("path level").lean();
      let np = { path: "", level: 0 };
      if (parent) {
        if (parent === id) throw new ApiError("VALIDATION_ERROR", "A category cannot be its own parent", { parent: "Invalid parent" });
        np = await (async () => {
          const p = await Category.findById(parent).session(session).select("path level").lean();
          if (!p) throw new ApiError("VALIDATION_ERROR", "Parent not found", { parent: "Choose an existing category" });
          if (p.path === cur.path || prefix.test(p.path)) throw new ApiError("VALIDATION_ERROR", "Cannot move a category under its own subcategory", { parent: "Invalid parent" });
          return p;
        })();
      }
      await touch([cur.parent, parent], session); // serialises against concurrent moves/deletes around these parents
      const newLevel = np.level + 1;
      const delta = newLevel - cur.level;
      const height = Math.max(0, ...descendants.map((d) => d.level - cur.level)) + 1;
      if (newLevel + height - 1 > MAX_CATEGORY_DEPTH) throw new ApiError("VALIDATION_ERROR", `Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep`, { parent: "Too deep" });
      const newPath = np.path ? `${np.path}/${input.slug}` : input.slug;

      if (newPath !== cur.path) {
        const moves = [{ from: `/category/${cur.path}`, to: `/category/${newPath}` }];
        // Move descendants out of the way first? Paths are unique, so renumber in a safe order: collision is only
        // possible with a non-subtree category, which the unique index reports as a conflict.
        const ops = descendants.map((d) => {
          const np2 = newPath + d.path.slice(cur.path.length);
          moves.push({ from: `/category/${d.path}`, to: `/category/${np2}` });
          return { updateOne: { filter: { _id: d._id }, update: { $set: { path: np2, level: d.level + delta } } } };
        });
        if (ops.length) await Category.bulkWrite(ops, { session, ordered: true });
        await clearRedirectsFrom([`/category/${newPath}`], session);
        await recordRedirects(moves, session);
      }
      const { image, seo, ...rest } = input;
      const updated = await Category.findByIdAndUpdate(id, { $set: { ...rest, image, seo, parent: parent ? new mongoose.Types.ObjectId(parent) : null, path: newPath, level: newLevel } }, { returnDocument: "after", session }).lean();
      result = toAdmin(updated!);
    });
    return result;
  } catch (err) {
    return dupPath(err);
  } finally {
    await session.endSession();
  }
}

export async function deleteCategory(id: string) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Category not found");
  await connectDB();
  const session = await mongoose.startSession();
  try {
    let path = "";
    await session.withTransaction(async () => {
      const c = await Category.findById(id).session(session).select("path parent").lean();
      if (!c) throw new ApiError("NOT_FOUND", "Category not found");
      await touch([id, c.parent], session); // a concurrent create/move under it now conflicts instead of orphaning
      if (await Category.exists({ parent: id }).session(session)) throw new ApiError("CONFLICT", "Delete or move its subcategories first");
      if (await Product.exists({ category: id }).session(session)) throw new ApiError("CONFLICT", "Move its products to another category first");
      await Category.deleteOne({ _id: id }, { session });
      await dropRedirectsTo([`/category/${c.path}`], session);
      path = c.path;
    });
    return { path };
  } finally {
    await session.endSession();
  }
}

// ---------- Public ----------

export type PublicCategory = { id: string; name: string; slug: string; path: string; description: string; image: { url: string; alt: string }; children: PublicCategory[] };

/** Active categories as a tree. An inactive category hides its whole subtree. */
export async function findCategoryTree(): Promise<PublicCategory[]> {
  await connectDB();
  const rows = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
  const nodes = new Map<string, PublicCategory>();
  for (const c of rows) nodes.set(String(c._id), { id: String(c._id), name: c.name, slug: c.slug, path: c.path, description: c.description ?? "", image: { url: c.image?.url ?? "", alt: c.image?.alt ?? "" }, children: [] });
  const roots: PublicCategory[] = [];
  for (const c of rows) {
    const node = nodes.get(String(c._id))!;
    if (!c.parent) roots.push(node);
    else nodes.get(String(c.parent))?.children.push(node); // parent inactive => absent => subtree dropped
  }
  return roots;
}
