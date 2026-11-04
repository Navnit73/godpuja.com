import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Product } from "../models/Product";
import { WishlistItem } from "../models/WishlistItem";
import { findCards, VISIBLE_STATUSES, type PublicProduct } from "./products";

export const WISHLIST_MAX = 200;
const oid = (id: string) => new mongoose.Types.ObjectId(id);

/** Ids only, newest first: enough to colour the hearts on any listing. */
export async function wishlistIds(userId: string): Promise<string[]> {
  await connectDB();
  const rows = await WishlistItem.find({ user: oid(userId) }).sort({ createdAt: -1, _id: -1 }).limit(WISHLIST_MAX).select("product").lean();
  return rows.map((r) => String(r.product));
}

/** Idempotent: saving the same product twice is a no-op. Only products a visitor could open can be saved. */
export async function addToWishlist(userId: string, productId: string): Promise<{ added: boolean }> {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError("NOT_FOUND", "Product not found");
  await connectDB();
  if (!(await Product.exists({ _id: productId, status: { $in: VISIBLE_STATUSES } }))) throw new ApiError("NOT_FOUND", "Product not found");
  if (await WishlistItem.exists({ user: oid(userId), product: oid(productId) })) return { added: false };
  if ((await WishlistItem.countDocuments({ user: oid(userId) })) >= WISHLIST_MAX) throw new ApiError("CONFLICT", `Your wishlist is full (${WISHLIST_MAX} items). Remove something first.`);
  try {
    await WishlistItem.create({ user: oid(userId), product: oid(productId) });
    return { added: true };
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return { added: false }; // a parallel request saved it first
    throw e;
  }
}

export async function removeFromWishlist(userId: string, productId: string): Promise<{ removed: boolean }> {
  if (!mongoose.isValidObjectId(productId)) return { removed: false };
  await connectDB();
  return { removed: (await WishlistItem.deleteOne({ user: oid(userId), product: oid(productId) })).deletedCount > 0 };
}

/** The wishlist as product cards, newest saved first. Products that are no longer public are left out. */
export async function listWishlist(userId: string): Promise<PublicProduct[]> {
  return findCards({ ids: await wishlistIds(userId) });
}
