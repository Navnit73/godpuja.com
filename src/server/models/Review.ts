import mongoose, { type Model } from "mongoose";
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/validation/reviews";

/**
 * A verified-purchase review (PRD v1.1 §5.3, §18). Only a customer with a delivered order containing the product can
 * write one, one per product. Reviews are moderated: they appear (and count toward the product's rating) only once
 * published, so no rating is shown that has not been seen by a person.
 */
export type ReviewDoc = {
  _id: mongoose.Types.ObjectId; product: mongoose.Types.ObjectId; user: mongoose.Types.ObjectId; order: mongoose.Types.ObjectId;
  rating: number; title: string; body: string; displayName: string; status: ReviewStatus;
  moderation?: { by: string; at: Date; note: string }; createdAt: Date; updatedAt: Date;
};
const schema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    title: { type: String, default: "", maxlength: 80 },
    body: { type: String, required: true, maxlength: 2000 },
    displayName: { type: String, required: true, maxlength: 60 },
    status: { type: String, enum: REVIEW_STATUSES, default: "pending" },
    moderation: { type: { by: String, at: Date, note: String, _id: false } },
  },
  { timestamps: true },
);
schema.index({ product: 1, user: 1 }, { unique: true });
schema.index({ product: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, createdAt: -1, _id: -1 });
if (process.env.NODE_ENV !== "production") delete mongoose.models.Review;
export const Review: Model<ReviewDoc> = (mongoose.models.Review as Model<ReviewDoc>) || mongoose.model<ReviewDoc>("Review", schema as never);
