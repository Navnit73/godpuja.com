import mongoose, { type ClientSession } from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Review, type ReviewDoc } from "../models/Review";
import { VISIBLE_STATUSES } from "./products";
import type { ReviewInput } from "@/lib/validation/reviews";
import type { ReviewStatus } from "@/lib/validation/reviews";
import { averageOf } from "@/lib/rating";

const isId = (id: string) => mongoose.isValidObjectId(id);
const dupKey = (e: unknown) => (e as { code?: number })?.code === 11000;
const oid = (id: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(id));

/** "Asha Rao" -> "Asha R." Shown next to a review instead of the full name. */
export function displayNameOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A customer";
  const first = parts[0].slice(0, 30);
  return parts.length > 1 ? `${first} ${Array.from(parts[parts.length - 1])[0].toUpperCase()}.` : first;
}

/**
 * Move a product's rating totals by (dCount, dSum), atomically (a pipeline update, so concurrent moderation can never
 * lose an increment) and keep the average in step. Totals never go below zero.
 */
async function adjustRating(productId: mongoose.Types.ObjectId, dCount: number, dSum: number, session: ClientSession) {
  await Product.updateOne({ _id: productId }, [
    { $set: { ratingCount: { $max: [0, { $add: [{ $ifNull: ["$ratingCount", 0] }, dCount] }] }, ratingSum: { $max: [0, { $add: [{ $ifNull: ["$ratingSum", 0] }, dSum] }] } } },
    // floor(x * 100 + 0.5) / 100 = round half up; identical to averageOf() in lib/rating.ts
    { $set: { ratingAvg: { $cond: [{ $gt: ["$ratingCount", 0] }, { $divide: [{ $floor: { $add: [{ $multiply: [{ $divide: ["$ratingSum", "$ratingCount"] }, 100] }, 0.5] } }, 100] }, 0] } } },
  ], { session, timestamps: false, updatePipeline: true });
}

async function inTx<T>(fn: (s: ClientSession) => Promise<T>): Promise<T> {
  const s = await mongoose.startSession();
  try {
    let out!: T;
    await s.withTransaction(async () => { out = await fn(s); });
    return out;
  } finally { await s.endSession(); }
}

const bySlug = async (slug: string) => {
  const p = await Product.findOne({ slug, status: { $in: VISIBLE_STATUSES } }).select("_id slug name status").lean();
  if (!p) throw new ApiError("NOT_FOUND", "Product not found");
  return p;
};

// ---------- the customer's own review ----------
export type MyReview = { id: string; rating: number; title: string; body: string; status: ReviewStatus; createdAt: string };
export type ReviewState = { eligible: boolean; reason: "not_purchased" | "unavailable" | null; review: MyReview | null };
const toMine = (r: ReviewDoc): MyReview => ({ id: String(r._id), rating: r.rating, title: r.title ?? "", body: r.body, status: r.status, createdAt: r.createdAt.toISOString() });

/** A review needs a delivered order that contains the product (verified purchase). */
const purchase = (userId: string, productId: mongoose.Types.ObjectId, session?: ClientSession) =>
  Order.findOne({ user: oid(userId), status: "delivered", "items.product": productId }).session(session ?? null).sort({ createdAt: -1 }).select("_id").lean();

export async function getReviewState(userId: string, slug: string): Promise<ReviewState> {
  await connectDB();
  const p = await bySlug(slug);
  const existing = await Review.findOne({ product: p._id, user: oid(userId) }).lean();
  if (existing) return { eligible: true, reason: null, review: toMine(existing) };
  const bought = await purchase(userId, p._id);
  return bought ? { eligible: true, reason: null, review: null } : { eligible: false, reason: "not_purchased", review: null };
}

/**
 * Write or change the customer's review. Always lands as `pending` (again, if it was edited), so what is shown has been
 * seen by a person. Editing a published review takes it (and its stars) out of the rating until it is approved again.
 */
export async function saveMyReview(userId: string, userName: string, slug: string, input: ReviewInput): Promise<{ review: MyReview; slug: string; created: boolean }> {
  await connectDB();
  const p = await bySlug(slug);
  try {
    return await inTx(async (session) => {
      const existing = await Review.findOne({ product: p._id, user: oid(userId) }).session(session);
      if (existing) {
        const wasPublished = existing.status === "published";
        const oldRating = existing.rating;
        existing.set({ rating: input.rating, title: input.title, body: input.body, status: "pending", displayName: displayNameOf(userName) });
        existing.set("moderation", undefined);
        await existing.save({ session });
        if (wasPublished) await adjustRating(p._id, -1, -oldRating, session);
        return { review: toMine(existing.toObject() as ReviewDoc), slug: p.slug, created: false };
      }
      const bought = await purchase(userId, p._id, session);
      if (!bought) throw new ApiError("FORBIDDEN", "Only customers who received this product can review it.");
      const [doc] = await Review.create([{ product: p._id, user: oid(userId), order: bought._id, rating: input.rating, title: input.title, body: input.body, displayName: displayNameOf(userName), status: "pending" }], { session });
      return { review: toMine(doc.toObject() as ReviewDoc), slug: p.slug, created: true };
    });
  } catch (e) {
    if (dupKey(e)) throw new ApiError("CONFLICT", "You have already reviewed this product. Reload to edit your review.");
    throw e;
  }
}

export async function deleteMyReview(userId: string, slug: string): Promise<{ slug: string }> {
  await connectDB();
  const p = await bySlug(slug);
  await inTx(async (session) => {
    const r = await Review.findOneAndDelete({ product: p._id, user: oid(userId) }, { session });
    if (!r) throw new ApiError("NOT_FOUND", "You have no review for this product");
    if (r.status === "published") await adjustRating(p._id, -1, -r.rating, session);
  });
  return { slug: p.slug };
}

// ---------- public ----------
export type PublicReview = { id: string; rating: number; title: string; body: string; displayName: string; createdAt: string };
export type ReviewSummary = { count: number; avg: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };

/** Published reviews, newest first, with the star breakdown. Computed from the reviews themselves. */
export async function findPublicReviews(productId: string, page = 1, limit = 10) {
  await connectDB();
  const pid = oid(productId);
  const [rows, dist] = await Promise.all([
    Review.find({ product: pid, status: "published" }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.aggregate<{ _id: number; n: number }>([{ $match: { product: pid, status: "published" } }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewSummary["distribution"];
  let count = 0, sum = 0;
  for (const d of dist) { distribution[d._id as 1] = d.n; count += d.n; sum += d._id * d.n; }
  const items: PublicReview[] = rows.map((r) => ({ id: String(r._id), rating: r.rating, title: r.title ?? "", body: r.body, displayName: r.displayName, createdAt: r.createdAt.toISOString() }));
  return { items, summary: { count, avg: averageOf(sum, count), distribution } as ReviewSummary, page, pages: Math.max(1, Math.ceil(count / limit)) };
}

// ---------- admin ----------
export type AdminReview = {
  id: string; productId: string; productName: string; productSlug: string; rating: number; title: string; body: string; displayName: string;
  status: ReviewStatus; createdAt: string; moderation: { by: string; at: string; note: string } | null;
};

export async function listReviews({ status, page, limit }: { status: ReviewStatus; page: number; limit: number }) {
  await connectDB();
  const filter = { status };
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), // oldest first: work the queue in order
    Review.countDocuments(filter),
  ]);
  const prods = await Product.find({ _id: { $in: [...new Set(rows.map((r) => String(r.product)))].map(oid) } }).select("name slug").lean();
  const byId = new Map(prods.map((p) => [String(p._id), p]));
  const items: AdminReview[] = rows.map((r) => ({
    id: String(r._id), productId: String(r.product), productName: byId.get(String(r.product))?.name ?? "(deleted product)", productSlug: byId.get(String(r.product))?.slug ?? "",
    rating: r.rating, title: r.title ?? "", body: r.body, displayName: r.displayName, status: r.status, createdAt: r.createdAt.toISOString(),
    moderation: r.moderation ? { by: r.moderation.by, at: r.moderation.at.toISOString(), note: r.moderation.note ?? "" } : null,
  }));
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function pendingReviewCount() {
  await connectDB();
  return Review.countDocuments({ status: "pending" });
}

/** Publish or reject. A compare-and-set on the status we saw, so two moderators cannot both apply; the product's rating moves in the same transaction. */
export async function moderateReview(id: string, to: "published" | "rejected", note: string | undefined, actor: string): Promise<{ slug: string; status: ReviewStatus }> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Review not found");
  await connectDB();
  return inTx(async (session) => {
    const r = await Review.findById(id).session(session).lean();
    if (!r) throw new ApiError("NOT_FOUND", "Review not found");
    if (r.status === to) throw new ApiError("CONFLICT", `This review is already ${to}.`);
    const res = await Review.updateOne({ _id: id, status: r.status }, { $set: { status: to, moderation: { by: actor, at: new Date(), note: note ?? "" } } }, { session });
    if (res.matchedCount === 0) throw new ApiError("CONFLICT", "This review was just changed by someone else. Reload and try again.");
    if (to === "published") await adjustRating(r.product, 1, r.rating, session);
    else if (r.status === "published") await adjustRating(r.product, -1, -r.rating, session);
    const p = await Product.findById(r.product).select("slug").session(session).lean();
    return { slug: p?.slug ?? "", status: to };
  });
}

export async function deleteReview(id: string): Promise<{ slug: string }> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Review not found");
  await connectDB();
  return inTx(async (session) => {
    const r = await Review.findOneAndDelete({ _id: id }, { session });
    if (!r) throw new ApiError("NOT_FOUND", "Review not found");
    if (r.status === "published") await adjustRating(r.product, -1, -r.rating, session);
    const p = await Product.findById(r.product).select("slug").session(session).lean();
    return { slug: p?.slug ?? "" };
  });
}
