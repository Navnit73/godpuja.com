import mongoose, { type Model } from "mongoose";

/** One saved product per row (PRD v1.1 §5.2, §11). Unique per user + product, so adding twice is harmless. */
export type WishlistItemDoc = { _id: mongoose.Types.ObjectId; user: mongoose.Types.ObjectId; product: mongoose.Types.ObjectId; createdAt: Date };
const schema = new mongoose.Schema(
  { user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true } },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
schema.index({ user: 1, product: 1 }, { unique: true });
schema.index({ user: 1, createdAt: -1, _id: -1 });
schema.index({ product: 1 });
if (process.env.NODE_ENV !== "production") delete mongoose.models.WishlistItem;
export const WishlistItem: Model<WishlistItemDoc> = (mongoose.models.WishlistItem as Model<WishlistItemDoc>) || mongoose.model<WishlistItemDoc>("WishlistItem", schema as never);
