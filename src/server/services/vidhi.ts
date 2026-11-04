import crypto from "node:crypto";
import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { renderMarkdown } from "../markdown";
import { Product } from "../models/Product";
import { Vidhi, type VidhiDoc } from "../models/Vidhi";
import { clearRedirectsFrom, dropRedirectsTo, recordRedirects } from "./redirects";
import { findCards, VISIBLE_STATUSES, type PublicProduct } from "./products";
import { vidhiCategoryLabel, vidhiHref, type ListVidhiInput, type VidhiCategory, type VidhiInput } from "@/lib/validation/vidhi";
import { publishProblems } from "@/lib/vidhi-rules";
import type { PublishInput } from "@/lib/validation/pages";

const isId = (id: string) => mongoose.isValidObjectId(id);
const iso = (d?: Date | null) => (d ? d.toISOString() : null);
const newToken = () => crypto.randomBytes(24).toString("base64url");
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type VidhiStatus = VidhiDoc["status"];
/** Live = published, or scheduled with a publish time that has passed. */
export const isLive = (p: { status: VidhiStatus; publishAt?: Date | null }, now = new Date()) =>
  p.status === "published" || (p.status === "scheduled" && !!p.publishAt && p.publishAt <= now);
const liveFilter = (now: Date) => ({ $or: [{ status: "published" as const }, { status: "scheduled" as const, publishAt: { $lte: now } }] });

// ---------- admin ----------
export type AdminVidhi = Omit<VidhiInput, "reviewedAt"> & {
  id: string; reviewedAt: string; status: VidhiStatus; publishAt: string | null; publishedAt: string | null; previewToken: string; createdAt: string; updatedAt: string;
};
export type VidhiListItem = { id: string; title: string; slug: string; category: VidhiCategory; status: VidhiStatus; publishAt: string | null; updatedAt: string; live: boolean; reviewed: boolean };

function toAdmin(v: VidhiDoc): AdminVidhi {
  return {
    id: String(v._id), title: v.title, slug: v.slug, category: v.category, deity: v.deity ?? "", summary: v.summary ?? "", significance: v.significance ?? "", preparation: v.preparation ?? "", body: v.body ?? "",
    samagri: (v.samagri ?? []).map((s) => ({ item: s.item, quantity: s.quantity ?? "", note: s.note ?? "", productSlug: s.productSlug ?? "" })),
    steps: (v.steps ?? []).map((s) => ({ title: s.title ?? "", body: s.body, mantra: s.mantra ?? "" })),
    mantras: (v.mantras ?? []).map((m) => ({ title: m.title, text: m.text, meaning: m.meaning ?? "" })),
    relatedAarti: v.relatedAarti ?? [], relatedProducts: v.relatedProducts ?? [], relatedVidhi: v.relatedVidhi ?? [], tags: v.tags ?? [], durationMinutes: v.durationMinutes ?? null,
    coverImageUrl: v.coverImageUrl ?? "", coverImageAlt: v.coverImageAlt ?? "", author: v.author ?? "", reviewer: v.reviewer ?? "", reviewedAt: iso(v.reviewedAt) ?? "",
    status: v.status, publishAt: iso(v.publishAt), publishedAt: iso(v.publishedAt), previewToken: v.previewToken,
    seo: { title: v.seo?.title ?? "", description: v.seo?.description ?? "", canonical: v.seo?.canonical ?? "", ogImage: v.seo?.ogImage ?? "", noindex: !!v.seo?.noindex },
    createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}

const normalise = (i: VidhiInput) => ({ ...i, reviewedAt: i.reviewedAt ? new Date(i.reviewedAt) : null });

function dupSlug(err: unknown): never {
  if ((err as { code?: number }).code === 11000) throw new ApiError("CONFLICT", "A guide with this URL already exists", { slug: "Already in use" });
  throw err;
}

/**
 * Everything a guide points at must exist, so a published guide never carries a dead link: shop products (in the
 * samagri list and "related products") and other guides. Aarti links are checked once that module exists (Stage 16);
 * until then they are stored and shown only when they resolve.
 */
async function verifyRefs(input: VidhiInput, selfSlug?: string) {
  await connectDB();
  const fields: Record<string, string> = {};
  const productSlugs = [...new Set([...input.relatedProducts, ...input.samagri.map((s) => s.productSlug).filter(Boolean)])];
  if (productSlugs.length) {
    const have = new Set((await Product.find({ slug: { $in: productSlugs }, status: { $in: VISIBLE_STATUSES } }).select("slug").lean()).map((p) => p.slug));
    input.samagri.forEach((s, i) => { if (s.productSlug && !have.has(s.productSlug)) fields[`samagri.${i}.productSlug`] = "No such product in the shop"; });
    const bad = input.relatedProducts.filter((s) => !have.has(s));
    if (bad.length) fields.relatedProducts = `No such product in the shop: ${bad.join(", ")}`;
  }
  const others = input.relatedVidhi.filter((s) => s !== selfSlug);
  if (others.length) {
    const have = new Set((await Vidhi.find({ slug: { $in: others } }).select("slug").lean()).map((v) => v.slug));
    const bad = others.filter((s) => !have.has(s));
    if (bad.length) fields.relatedVidhi = `No such guide: ${bad.join(", ")}`;
  }
  if (Object.keys(fields).length) throw new ApiError("VALIDATION_ERROR", "Some links point to things that do not exist.", fields);
}

export async function listVidhi({ q, status, category, page, limit }: ListVidhiInput) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$or = [{ title: rx }, { slug: rx }, { deity: rx }]; }
  const [rows, total] = await Promise.all([
    Vidhi.find(filter).select("title slug category status publishAt updatedAt reviewer reviewedAt").sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Vidhi.countDocuments(filter),
  ]);
  const now = new Date();
  const items: VidhiListItem[] = rows.map((v) => ({ id: String(v._id), title: v.title, slug: v.slug, category: v.category, status: v.status, publishAt: iso(v.publishAt), updatedAt: v.updatedAt.toISOString(), live: isLive(v, now), reviewed: !!v.reviewer && !!v.reviewedAt }));
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getVidhi(id: string): Promise<AdminVidhi> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Guide not found");
  await connectDB();
  const v = await Vidhi.findById(id).lean();
  if (!v) throw new ApiError("NOT_FOUND", "Guide not found");
  return toAdmin(v);
}

export async function createVidhi(input: VidhiInput): Promise<AdminVidhi> {
  await verifyRefs(input);
  try {
    const v = await Vidhi.create({ ...normalise(input), status: "draft", previewToken: newToken() });
    await clearRedirectsFrom([vidhiHref(v.slug)]);
    return toAdmin(v.toObject() as VidhiDoc);
  } catch (err) { return dupSlug(err); }
}

const notPublishable = () => new ApiError("FORBIDDEN", "Only users who can publish may change a published guide");

/** Content edit; compare-and-set on the version the editor loaded (409 if someone else saved first). Changing the slug keeps the old URL working. */
export async function updateVidhi(id: string, input: VidhiInput, baseUpdatedAt: string, { draftOnly = false } = {}) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Guide not found");
  await connectDB();
  await verifyRefs(input, input.slug);
  let prev: { slug: string } | null;
  try {
    prev = await Vidhi.findOneAndUpdate({ _id: id, updatedAt: new Date(baseUpdatedAt), ...(draftOnly ? { status: "draft" as const } : {}) }, { $set: normalise(input) }, { returnDocument: "before" }).select("slug").lean();
  } catch (err) { return dupSlug(err); }
  if (!prev) {
    const cur = await Vidhi.findById(id).select("status").lean();
    if (!cur) throw new ApiError("NOT_FOUND", "Guide not found");
    if (draftOnly && cur.status !== "draft") throw notPublishable();
    throw new ApiError("CONFLICT", "This guide was changed by someone else. Reload to see their changes before saving.");
  }
  if (prev.slug !== input.slug) {
    await clearRedirectsFrom([vidhiHref(input.slug)]);
    await recordRedirects([{ from: vidhiHref(prev.slug), to: vidhiHref(input.slug) }]);
    // Other guides that listed the old slug as related follow the rename.
    await Vidhi.updateMany({ relatedVidhi: prev.slug }, { $set: { "relatedVidhi.$[e]": input.slug } }, { arrayFilters: [{ e: prev.slug }], timestamps: false });
  }
  return { vidhi: await getVidhi(id), previousSlug: prev.slug };
}

export async function deleteVidhi(id: string, { draftOnly = false } = {}) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Guide not found");
  await connectDB();
  const v = await Vidhi.findOneAndDelete({ _id: id, ...(draftOnly ? { status: "draft" as const } : {}) }).select("slug").lean();
  if (!v) {
    if (draftOnly && (await Vidhi.exists({ _id: id }))) throw notPublishable();
    throw new ApiError("NOT_FOUND", "Guide not found");
  }
  await dropRedirectsTo([vidhiHref(v.slug)]);
  await Vidhi.updateMany({ relatedVidhi: v.slug }, { $pull: { relatedVidhi: v.slug } }, { timestamps: false }); // no dead "related" links
  return { slug: v.slug };
}

/** Publish, unpublish or schedule. Publishing something already live keeps its original date. Compare-and-set, retried on a concurrent change. */
export async function setVidhiPublishState(id: string, input: PublishInput) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Guide not found");
  await connectDB();
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await Vidhi.findById(id).select("status publishAt publishedAt summary steps body reviewer reviewedAt").lean();
    if (!cur) throw new ApiError("NOT_FOUND", "Guide not found");
    if (input.action !== "unpublish") {
      const problems = publishProblems(cur);
      if (Object.keys(problems).length) throw new ApiError("VALIDATION_ERROR", Object.values(problems)[0], problems);
    }
    const now = new Date();
    let update: Record<string, unknown>;
    if (input.action === "publish") {
      const keep = isLive(cur, now) && cur.publishedAt ? cur.publishedAt : now;
      update = { $set: { status: "published", publishedAt: keep }, $unset: { publishAt: 1 } };
    } else if (input.action === "unpublish") update = { $set: { status: "draft" }, $unset: { publishAt: 1, publishedAt: 1 } };
    else { const at = new Date(input.publishAt); update = { $set: { status: "scheduled", publishAt: at, publishedAt: at } }; }
    const v = await Vidhi.findOneAndUpdate({ _id: id, status: cur.status, publishAt: cur.publishAt ?? null, publishedAt: cur.publishedAt ?? null }, update, { returnDocument: "after" }).lean();
    if (v) return toAdmin(v);
  }
  throw new ApiError("CONFLICT", "This guide is being changed right now. Try again.");
}

/** New secret preview link; the old one stops working. Does not change `updatedAt`, so it cannot cause a false edit conflict. */
export async function rotateVidhiPreviewToken(id: string) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Guide not found");
  await connectDB();
  const v = await Vidhi.findByIdAndUpdate(id, { $set: { previewToken: newToken() } }, { returnDocument: "after", timestamps: false }).lean();
  if (!v) throw new ApiError("NOT_FOUND", "Guide not found");
  return toAdmin(v);
}

// ---------- public ----------
export type VidhiCard = { id: string; slug: string; title: string; category: VidhiCategory; categoryLabel: string; deity: string; excerpt: string; cover: { url: string; alt: string } | null; durationMinutes: number | null };
export type PublicVidhi = {
  id: string; slug: string; title: string; category: VidhiCategory; categoryLabel: string; deity: string;
  summaryHtml: string; significanceHtml: string; preparationHtml: string; bodyHtml: string;
  samagri: { item: string; quantity: string; note: string; product: Pick<PublicProduct, "slug" | "name" | "price" | "salePrice" | "inStock"> | null }[];
  steps: { title: string; bodyHtml: string; mantra: string }[];
  mantras: { title: string; text: string; meaning: string }[];
  /** Aarti slugs, shown once the Aarti module can resolve them. */
  relatedAarti: string[]; relatedProducts: PublicProduct[]; relatedVidhi: VidhiCard[];
  tags: string[]; durationMinutes: number | null; cover: { url: string; alt: string } | null;
  author: string; reviewer: string; reviewedAt: string | null; publishedAt: string | null; updatedAt: string;
  seo: AdminVidhi["seo"]; excerpt: string;
};

/** Plain-text excerpt of Markdown for cards and meta descriptions. */
export function plainExcerpt(md: string, max = 160) {
  const t = md.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`~|]/g, "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

const toCard = (v: Pick<VidhiDoc, "_id" | "slug" | "title" | "category" | "deity" | "summary" | "coverImageUrl" | "coverImageAlt" | "durationMinutes">): VidhiCard => ({
  id: String(v._id), slug: v.slug, title: v.title, category: v.category, categoryLabel: vidhiCategoryLabel(v.category), deity: v.deity ?? "", excerpt: plainExcerpt(v.summary ?? ""),
  cover: v.coverImageUrl ? { url: v.coverImageUrl, alt: v.coverImageAlt ?? "" } : null, durationMinutes: v.durationMinutes ?? null,
});
const CARD_FIELDS = "slug title category deity summary coverImageUrl coverImageAlt durationMinutes";

async function toPublic(v: VidhiDoc, now: Date): Promise<PublicVidhi> {
  const productSlugs = [...new Set([...(v.relatedProducts ?? []), ...(v.samagri ?? []).map((s) => s.productSlug).filter(Boolean)])];
  const [cards, related] = await Promise.all([
    findCards({ slugs: productSlugs }),
    v.relatedVidhi?.length ? Vidhi.find({ slug: { $in: v.relatedVidhi }, ...liveFilter(now) }).select(CARD_FIELDS).lean() : Promise.resolve([]),
  ]);
  const bySlug = new Map(cards.map((c) => [c.slug, c]));
  const relatedBySlug = new Map(related.map((r) => [r.slug, r]));
  return {
    id: String(v._id), slug: v.slug, title: v.title, category: v.category, categoryLabel: vidhiCategoryLabel(v.category), deity: v.deity ?? "",
    summaryHtml: renderMarkdown(v.summary ?? ""), significanceHtml: renderMarkdown(v.significance ?? ""), preparationHtml: renderMarkdown(v.preparation ?? ""), bodyHtml: renderMarkdown(v.body ?? ""),
    samagri: (v.samagri ?? []).map((s) => {
      const p = s.productSlug ? bySlug.get(s.productSlug) : undefined; // a product that is gone just loses its Buy link
      return { item: s.item, quantity: s.quantity ?? "", note: s.note ?? "", product: p ? { slug: p.slug, name: p.name, price: p.price, salePrice: p.salePrice, inStock: p.inStock } : null };
    }),
    steps: (v.steps ?? []).map((s) => ({ title: s.title ?? "", bodyHtml: renderMarkdown(s.body), mantra: s.mantra ?? "" })),
    mantras: (v.mantras ?? []).map((m) => ({ title: m.title, text: m.text, meaning: m.meaning ?? "" })),
    relatedAarti: v.relatedAarti ?? [],
    relatedProducts: (v.relatedProducts ?? []).map((s) => bySlug.get(s)).filter((p): p is PublicProduct => !!p),
    relatedVidhi: (v.relatedVidhi ?? []).map((s) => relatedBySlug.get(s)).filter((r): r is NonNullable<typeof r> => !!r).map(toCard),
    tags: v.tags ?? [], durationMinutes: v.durationMinutes ?? null, cover: v.coverImageUrl ? { url: v.coverImageUrl, alt: v.coverImageAlt ?? "" } : null,
    author: v.author ?? "", reviewer: v.reviewer ?? "", reviewedAt: iso(v.reviewedAt), publishedAt: iso(v.publishedAt), updatedAt: v.updatedAt.toISOString(),
    seo: { title: v.seo?.title ?? "", description: v.seo?.description ?? "", canonical: v.seo?.canonical ?? "", ogImage: v.seo?.ogImage ?? "", noindex: !!v.seo?.noindex },
    excerpt: plainExcerpt(v.summary ?? ""),
  };
}

export async function findPublicVidhi(slug: string, now = new Date()): Promise<PublicVidhi | null> {
  await connectDB();
  const v = await Vidhi.findOne({ slug, ...liveFilter(now) }).lean();
  return v ? toPublic(v, now) : null;
}

/** Draft preview by secret token (any status). */
export async function findPreviewVidhi(token: string, now = new Date()): Promise<PublicVidhi | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  await connectDB();
  const v = await Vidhi.findOne({ previewToken: token }).lean();
  return v ? toPublic(v, now) : null;
}

export async function findPublicVidhiList({ category, page = 1, limit = 12 }: { category?: VidhiCategory; page?: number; limit?: number }, now = new Date()) {
  await connectDB();
  const base = liveFilter(now);
  const filter = { ...base, ...(category ? { category } : {}) };
  const [rows, total, counts] = await Promise.all([
    Vidhi.find(filter).select(CARD_FIELDS).sort({ publishedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Vidhi.countDocuments(filter),
    Vidhi.aggregate<{ _id: VidhiCategory; n: number }>([{ $match: base }, { $group: { _id: "$category", n: { $sum: 1 } } }]),
  ]);
  return { items: rows.map(toCard), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) as Partial<Record<VidhiCategory, number>> };
}

/** Live guides for the sitemap, newest first. */
export async function findVidhiForSitemap(now = new Date()) {
  await connectDB();
  return Vidhi.find({ ...liveFilter(now), "seo.noindex": { $ne: true } }).select("slug updatedAt").sort({ updatedAt: -1 }).limit(5000).lean();
}

/** Does a live guide with this slug exist? (Used by the proxy to give real 404s.) */
export async function vidhiExists(slug: string, now = new Date()) {
  await connectDB();
  return !!(await Vidhi.exists({ slug, ...liveFilter(now) }));
}
