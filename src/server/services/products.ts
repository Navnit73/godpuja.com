import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { renderMarkdown } from "../markdown";
import { Category } from "../models/Category";
import { Product, type ProductDoc } from "../models/Product";
import { clearRedirectsFrom, dropRedirectsTo, recordRedirects } from "./redirects";
import type { InventoryInput, ListProductsInput, ProductInput, PublicProductsInput, UpdateProductInput } from "@/lib/validation/catalog";

type Variant = ProductDoc["variants"][number];
export type AdminProduct = Omit<ProductInput, "variants"> & { id: string; variants: Variant[]; soldCount: number; createdAt: string; updatedAt: string };
export type ProductListItem = {
  id: string; name: string; slug: string; sku: string; status: ProductInput["status"]; price: number; salePrice: number | null;
  stock: number; lowStock: boolean; category: string | null; image: string | null; updatedAt: string;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isId = (id: string) => mongoose.isValidObjectId(id);
const plainOptions = (o: unknown) => (o instanceof Map ? Object.fromEntries(o) : ({ ...(o as object) } as Record<string, string>));
const totalStock = (p: { stock: number; variants?: { stock: number }[] }) => (p.variants?.length ? p.variants.reduce((n, v) => n + v.stock, 0) : p.stock);
const isLow = (p: { stock: number; lowStockThreshold: number; variants?: { stock: number }[] }) =>
  p.variants?.length ? p.variants.some((v) => v.stock <= p.lowStockThreshold) : p.stock <= p.lowStockThreshold;

function toAdmin(p: ProductDoc): AdminProduct {
  return {
    id: String(p._id), name: p.name, slug: p.slug, sku: p.sku, shortDescription: p.shortDescription ?? "", description: p.description ?? "",
    images: (p.images ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((i) => ({ url: i.url!, alt: i.alt ?? "" })),
    category: p.category ? String(p.category) : null, brand: p.brand ?? "", price: p.price, salePrice: p.salePrice ?? null, stock: p.stock ?? 0,
    lowStockThreshold: p.lowStockThreshold ?? 5, status: p.status, isFeatured: !!p.isFeatured,
    attributes: (p.attributes ?? []).map((a) => ({ name: a.name!, value: a.value! })),
    variants: (p.variants ?? []).map((v) => ({ sku: v.sku, options: plainOptions(v.options), price: v.price ?? null, salePrice: v.salePrice ?? null, stock: v.stock })),
    shipping: { weightGrams: p.shipping?.weightGrams ?? 0, length: p.shipping?.length ?? 0, width: p.shipping?.width ?? 0, height: p.shipping?.height ?? 0, freeShipping: !!p.shipping?.freeShipping },
    seo: { title: p.seo?.title ?? "", description: p.seo?.description ?? "", canonical: p.seo?.canonical ?? "", ogImage: p.seo?.ogImage ?? "", noindex: !!p.seo?.noindex },
    soldCount: p.soldCount ?? 0, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

/** Everything the editor may write. Stock is deliberately absent: after creation it changes only via `adjustStock`. */
function writable(i: ProductInput) {
  return {
    name: i.name, slug: i.slug, sku: i.sku, shortDescription: i.shortDescription, description: i.description,
    images: i.images.map((x, n) => ({ ...x, order: n })), category: i.category ? new mongoose.Types.ObjectId(i.category) : null, brand: i.brand,
    price: i.price, salePrice: i.salePrice ?? null, effectivePrice: i.salePrice ?? i.price, lowStockThreshold: i.lowStockThreshold,
    status: i.status, isFeatured: i.isFeatured, attributes: i.attributes, shipping: i.shipping, seo: i.seo,
  };
}

function dup(err: unknown): never {
  if ((err as { code?: number }).code === 11000) {
    const key = JSON.stringify((err as { keyPattern?: object }).keyPattern ?? {});
    if (key.includes("slug")) throw new ApiError("CONFLICT", "A product with this URL already exists", { slug: "Already in use" });
    throw new ApiError("CONFLICT", "This SKU is already used by another product", key.includes("variants") ? { variants: "A variant SKU is already in use" } : { sku: "Already in use" });
  }
  throw err;
}

/** SKUs are one namespace: a product SKU may not equal another product's SKU or variant SKU (and vice versa). */
async function assertSkusFree(input: ProductInput, selfId?: string) {
  const skus = [input.sku, ...input.variants.map((v) => v.sku)];
  const clash = await Product.findOne({ ...(selfId ? { _id: { $ne: selfId } } : {}), $or: [{ sku: { $in: skus } }, { "variants.sku": { $in: skus } }] }).select("sku variants.sku").lean();
  if (clash) {
    const taken = skus.find((k) => clash.sku === k || clash.variants?.some((v) => v.sku === k)) ?? input.sku;
    throw new ApiError("CONFLICT", `SKU ${taken} is already used by another product`, taken === input.sku ? { sku: "Already in use" } : { variants: `SKU ${taken} is already in use` });
  }
}

async function assertCategory(id: string | null) {
  if (id && !(await Category.exists({ _id: id }))) throw new ApiError("VALIDATION_ERROR", "Category not found", { category: "Choose an existing category" });
}

function adminFilter({ q, status, category, lowStock }: ListProductsInput) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$or = [{ name: rx }, { sku: rx }, { "variants.sku": rx }]; }
  if (lowStock) {
    filter.$expr = { $cond: [{ $gt: [{ $size: "$variants" }, 0] }, { $anyElementTrue: { $map: { input: "$variants", as: "v", in: { $lte: ["$$v.stock", "$lowStockThreshold"] } } } }, { $lte: ["$stock", "$lowStockThreshold"] }] };
  }
  return filter;
}

export async function listProducts(input: ListProductsInput) {
  const { page, limit } = input;
  await connectDB();
  const filter = adminFilter(input);
  const [rows, total, cats] = await Promise.all([
    Product.find(filter).select("name slug sku status price salePrice stock lowStockThreshold variants category images updatedAt").sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
    Category.find().select("name path").lean(),
  ]);
  const catName = new Map(cats.map((c) => [String(c._id), c.path]));
  const items: ProductListItem[] = rows.map((p) => ({
    id: String(p._id), name: p.name, slug: p.slug, sku: p.sku, status: p.status, price: p.price, salePrice: p.salePrice ?? null,
    stock: totalStock(p), lowStock: isLow(p), category: p.category ? catName.get(String(p.category)) ?? null : null,
    image: [...(p.images ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]?.url ?? null, updatedAt: p.updatedAt.toISOString(),
  }));
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export type InventoryItem = { id: string; name: string; sku: string; status: ProductInput["status"]; stock: number; lowStockThreshold: number; lowStock: boolean; variants: { sku: string; options: Record<string, string>; stock: number }[] };
export async function listInventory(input: ListProductsInput) {
  const { page, limit } = input;
  await connectDB();
  const filter = adminFilter(input);
  const [rows, total] = await Promise.all([
    Product.find(filter).select("name sku status stock lowStockThreshold variants").sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  const items: InventoryItem[] = rows.map((p) => ({
    id: String(p._id), name: p.name, sku: p.sku, status: p.status, stock: p.stock ?? 0, lowStockThreshold: p.lowStockThreshold ?? 5, lowStock: isLow(p),
    variants: (p.variants ?? []).map((v) => ({ sku: v.sku, options: plainOptions(v.options), stock: v.stock })),
  }));
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getProduct(id: string): Promise<AdminProduct> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Product not found");
  await connectDB();
  const p = await Product.findById(id).lean();
  if (!p) throw new ApiError("NOT_FOUND", "Product not found");
  return toAdmin(p);
}

export async function createProduct(input: ProductInput) {
  await connectDB();
  await assertCategory(input.category);
  await assertSkusFree(input);
  try {
    await clearRedirectsFrom([`/product/${input.slug}`]);
    const p = await Product.create({ ...writable(input), stock: input.stock, variants: input.variants });
    const obj = p.toObject() as unknown as ProductDoc;
    return toAdmin(obj);
  } catch (err) {
    return dup(err);
  }
}

/**
 * Content edit. Stock is preserved (variants keep their current stock by SKU; new variants start with the stock
 * given), so editing a product can never overwrite stock changed by an order or inventory adjustment in between.
 * Read + write run in a transaction so a concurrent stock change makes this retry instead of being lost.
 * A slug change records a 301.
 */
export async function updateProduct(id: string, { baseUpdatedAt, ...input }: UpdateProductInput) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Product not found");
  await connectDB();
  await assertCategory(input.category);
  await assertSkusFree(input, id);
  const session = await mongoose.startSession();
  try {
    let out!: { product: AdminProduct; previousSlug: string };
    await session.withTransaction(async () => {
      const cur = await Product.findById(id).session(session).lean();
      if (!cur) throw new ApiError("NOT_FOUND", "Product not found");
      if (cur.updatedAt.getTime() !== new Date(baseUpdatedAt).getTime()) {
        throw new ApiError("CONFLICT", "This product was changed by someone else. Reload to see their changes before saving.");
      }
      const stockBySku = new Map((cur.variants ?? []).map((v) => [v.sku, v.stock]));
      const variants = input.variants.map((v) => ({ ...v, stock: stockBySku.get(v.sku) ?? v.stock }));
      const updated = await Product.findByIdAndUpdate(id, { $set: { ...writable(input), variants } }, { returnDocument: "after", session }).lean();
      if (cur.slug !== input.slug) await clearRedirectsFrom([`/product/${input.slug}`], session);
      if (cur.slug !== input.slug) await recordRedirects([{ from: `/product/${cur.slug}`, to: `/product/${input.slug}` }], session);
      out = { product: toAdmin(updated!), previousSlug: cur.slug };
    });
    return out;
  } catch (err) {
    return dup(err);
  } finally {
    await session.endSession();
  }
}

export async function deleteProduct(id: string) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Product not found");
  await connectDB();
  const p = await Product.findByIdAndDelete(id).select("slug").lean();
  if (!p) throw new ApiError("NOT_FOUND", "Product not found");
  await dropRedirectsTo([`/product/${p.slug}`]); // do not leave redirects that lead to a deleted page
  return { slug: p.slug };
}

/**
 * Atomic stock change. Relative changes carry a guard (`stock >= -delta`) inside the single update, so concurrent
 * decrements can never drive stock below zero; there is no read-modify-write. `timestamps: false` keeps an
 * inventory change from invalidating an editor's `baseUpdatedAt`.
 */
const MAX_STOCK = 10_000_000;
export async function adjustStock(id: string, input: InventoryInput) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Product not found");
  await connectDB();
  const sku = input.sku;
  const rel = "delta" in input;
  const cur = await Product.findById(id).select("variants sku slug").lean();
  if (!cur) throw new ApiError("NOT_FOUND", "Product not found");
  const hasVariants = (cur.variants ?? []).length > 0;
  if (hasVariants && !sku) throw new ApiError("VALIDATION_ERROR", "This product has variants; choose a variant SKU", { sku: "Required" });
  if (!hasVariants && sku && sku !== cur.sku) throw new ApiError("NOT_FOUND", "SKU not found on this product", { sku: "Unknown SKU" });

  let res;
  if (hasVariants) {
    const guard = rel ? { $elemMatch: { sku, stock: input.delta < 0 ? { $gte: -input.delta } : { $lte: MAX_STOCK - input.delta } } } : { $elemMatch: { sku } };
    res = await Product.updateOne({ _id: id, variants: guard }, rel ? { $inc: { "variants.$.stock": input.delta } } : { $set: { "variants.$.stock": input.set } }, { timestamps: false });
  } else {
    const filter: Record<string, unknown> = { _id: id };
    if (rel) filter.stock = input.delta < 0 ? { $gte: -input.delta } : { $lte: MAX_STOCK - input.delta }; // never below 0 or above the cap
    res = await Product.updateOne(filter, rel ? { $inc: { stock: input.delta } } : { $set: { stock: input.set } }, { timestamps: false });
  }
  if (res.matchedCount === 0) {
    const exists = hasVariants ? await Product.exists({ _id: id, "variants.sku": sku }) : true;
    if (!exists) throw new ApiError("NOT_FOUND", "SKU not found on this product", { sku: "Unknown SKU" });
    throw new ApiError("CONFLICT", "Not enough stock for that change, or it would exceed the maximum");
  }
  const p = await Product.findById(id).select("stock variants lowStockThreshold").lean();
  return { slug: cur.slug, stock: totalStock(p!), variants: (p!.variants ?? []).map((v) => ({ sku: v.sku, stock: v.stock })), lowStock: isLow(p!) };
}

// ---------- Public (storefront) ----------

export type PublicProduct = {
  id: string; name: string; slug: string; shortDescription: string; image: { url: string; alt: string } | null;
  price: number; salePrice: number | null; inStock: boolean; isFeatured: boolean; category: string | null;
};
export type PublicProductDetail = Omit<PublicProduct, "image"> & {
  sku: string; descriptionHtml: string; images: { url: string; alt: string }[]; brand: string;
  attributes: { name: string; value: string }[]; categoryPath: string | null;
  variants: { sku: string; options: Record<string, string>; price: number; salePrice: number | null; inStock: boolean }[];
  seo: ProductInput["seo"]; freeShipping: boolean; breadcrumbs: { name: string; path: string }[];
};

export const sortedImages = (p: ProductDoc) => [...(p.images ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((i) => ({ url: i.url!, alt: i.alt ?? "" }));
export const inStock = (p: ProductDoc) => (p.variants?.length ? p.variants.some((v) => v.stock > 0) : p.stock > 0);

/**
 * Path + visibility index of all categories (one small query). `hidden` = ids of inactive categories and everything
 * beneath them; public product queries exclude these so hiding a category really hides its products everywhere.
 */
export async function loadCategoryIndex() {
  await connectDB();
  const rows = await Category.find().select("path isActive").lean();
  const inactive = rows.filter((r) => r.isActive === false).map((r) => r.path);
  const hidden = rows.filter((r) => inactive.some((p) => r.path === p || r.path.startsWith(p + "/"))).map((r) => r._id);
  return { catPath: new Map(rows.map((c) => [String(c._id), c.path])), hidden };
}

/** Category path -> ids of that category and its active descendants (whole chain must be active). null = unknown/inactive. */
export async function activeCategoryIds(path: string): Promise<mongoose.Types.ObjectId[] | null> {
  const parts = path.split("/");
  const ancestors = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
  if (ancestors.length && (await Category.exists({ path: { $in: ancestors }, isActive: false }))) return null; // hidden by an inactive ancestor
  const rows = await Category.find({ $or: [{ path }, { path: { $regex: `^${escapeRegex(path)}/` } }], isActive: true }).select("path parent").sort({ path: 1 }).lean();
  const root = rows.find((r) => r.path === path);
  if (!root) return null;
  const ok = new Set([String(root._id)]);
  for (const r of rows) if (r.parent && ok.has(String(r.parent))) ok.add(String(r._id));
  return rows.filter((r) => ok.has(String(r._id))).map((r) => r._id);
}

export async function findPublicProducts(q: PublicProductsInput) {
  await connectDB();
  const filter: Record<string, unknown> = { status: "active" };
  if (q.category) {
    const ids = await activeCategoryIds(q.category);
    if (!ids) return { items: [] as PublicProduct[], total: 0, page: q.page, limit: q.limit, pages: 1 };
    filter.category = { $in: ids };
  }
  if (q.featured) filter.isFeatured = true;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.effectivePrice = { ...(q.minPrice !== undefined ? { $gte: q.minPrice } : {}), ...(q.maxPrice !== undefined ? { $lte: q.maxPrice } : {}) };
  }
  if (q.q) filter.$text = { $search: q.q };
  const sort: Record<string, 1 | -1> =
    q.sort === "price-asc" ? { effectivePrice: 1, _id: 1 } : q.sort === "price-desc" ? { effectivePrice: -1, _id: -1 }
    : q.sort === "popular" ? { soldCount: -1, _id: -1 } : { createdAt: -1, _id: -1 };
  const { catPath: path, hidden } = await loadCategoryIndex();
  if (hidden.length && !q.category) filter.category = { $nin: hidden };
  const [rows, total] = await Promise.all([
    Product.find(filter).select("name slug shortDescription images price salePrice stock variants isFeatured category").sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Product.countDocuments(filter),
  ]);
  const items: PublicProduct[] = rows.map((p) => ({
    id: String(p._id), name: p.name, slug: p.slug, shortDescription: p.shortDescription ?? "", image: sortedImages(p as ProductDoc)[0] ?? null,
    price: p.price, salePrice: p.salePrice ?? null, inStock: inStock(p as ProductDoc), isFeatured: !!p.isFeatured, category: p.category ? path.get(String(p.category)) ?? null : null,
  }));
  return { items, total, page: q.page, limit: q.limit, pages: Math.max(1, Math.ceil(total / q.limit)) };
}

export async function findPublicProduct(slug: string): Promise<PublicProductDetail | null> {
  await connectDB();
  const p = await Product.findOne({ slug, status: "active" }).lean();
  if (!p) return null;
  const cat = p.category ? await Category.findById(p.category).select("path isActive").lean() : null;
  if (p.category) {
    const { hidden } = await loadCategoryIndex();
    if (hidden.some((h) => String(h) === String(p.category))) return null; // its category (or an ancestor) is hidden
  }
  const parts = cat?.path ? cat.path.split("/") : [];
  const chain = parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  const named = chain.length ? await Category.find({ path: { $in: chain } }).select("name path").lean() : [];
  const nameOf = new Map(named.map((c) => [c.path, c.name]));
  return {
    breadcrumbs: chain.map((c) => ({ name: nameOf.get(c) ?? c.split("/").pop()!, path: c })),
    id: String(p._id), name: p.name, slug: p.slug, sku: p.sku, shortDescription: p.shortDescription ?? "", descriptionHtml: renderMarkdown(p.description ?? ""),
    images: sortedImages(p), brand: p.brand ?? "", price: p.price, salePrice: p.salePrice ?? null, inStock: inStock(p), isFeatured: !!p.isFeatured,
    category: cat?.path ?? null, categoryPath: cat?.path ?? null, attributes: (p.attributes ?? []).map((a) => ({ name: a.name!, value: a.value! })),
    variants: (p.variants ?? []).map((v) => ({ sku: v.sku, options: plainOptions(v.options), price: v.price ?? p.price, salePrice: v.salePrice ?? (v.price == null ? p.salePrice ?? null : null), inStock: v.stock > 0 })),
    seo: { title: p.seo?.title ?? "", description: p.seo?.description ?? "", canonical: p.seo?.canonical ?? "", ogImage: p.seo?.ogImage ?? "", noindex: !!p.seo?.noindex },
    freeShipping: !!p.shipping?.freeShipping,
  };
}

// ---------- Homepage rails ----------

export type RailSpec = { kind: "featuredProducts" | "latestProducts" | "bestSellers"; category: string; limit: number };

const toPublicProduct = (p: ProductDoc, catPath: Map<string, string>): PublicProduct => ({
  id: String(p._id), name: p.name, slug: p.slug, shortDescription: p.shortDescription ?? "", image: sortedImages(p)[0] ?? null,
  price: p.price, salePrice: p.salePrice ?? null, inStock: inStock(p), isFeatured: !!p.isFeatured, category: p.category ? catPath.get(String(p.category)) ?? null : null,
});

/** One indexed, limited query for a homepage product rail. Callers run all rails in parallel (never per product). */
export async function findRail(spec: RailSpec, catPath: Map<string, string>, hidden: mongoose.Types.ObjectId[] = []): Promise<PublicProduct[]> {
  await connectDB();
  const filter: Record<string, unknown> = { status: "active" };
  if (spec.kind === "featuredProducts") filter.isFeatured = true;
  if (spec.category) {
    const ids = await activeCategoryIds(spec.category);
    if (!ids) return [];
    filter.category = { $in: ids };
  } else if (hidden.length) filter.category = { $nin: hidden };
  // _id tiebreaker keeps the order stable between cache refreshes when many products tie (e.g. all unsold); the
  // compound indexes end in _id so the sort is still served from the index.
  const sort: Record<string, 1 | -1> = spec.kind === "bestSellers" ? { soldCount: -1, _id: -1 } : { createdAt: -1, _id: -1 };
  const rows = await Product.find(filter).select("name slug shortDescription images price salePrice stock variants isFeatured category").sort(sort).limit(spec.limit).lean();
  return rows.map((p) => toPublicProduct(p as ProductDoc, catPath));
}

/** Up to `limit` other active products from the same category (best sellers first), topped up with featured ones. */
export async function findRelated(slug: string, limit = 4): Promise<PublicProduct[]> {
  await connectDB();
  const base = await Product.findOne({ slug, status: "active" }).select("category").lean();
  if (!base) return [];
  const { catPath, hidden } = await loadCategoryIndex();
  const notHidden = hidden.length ? { category: { $nin: hidden } } : {};
  const pick = "name slug shortDescription images price salePrice stock variants isFeatured category";
  const out: ProductDoc[] = [];
  if (base.category) {
    out.push(...((await Product.find({ status: "active", category: base.category, slug: { $ne: slug } }).select(pick).sort({ soldCount: -1, _id: -1 }).limit(limit).lean()) as ProductDoc[]));
  }
  if (out.length < limit) {
    const have = [slug, ...out.map((p) => p.slug)];
    out.push(...((await Product.find({ status: "active", isFeatured: true, slug: { $nin: have }, ...notHidden }).select(pick).sort({ createdAt: -1, _id: -1 }).limit(limit - out.length).lean()) as ProductDoc[]));
  }
  return out.map((p) => toPublicProduct(p, catPath));
}
