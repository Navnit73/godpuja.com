import mongoose, { type Model } from "mongoose";
import { COUPON_TYPES, type CouponType } from "@/lib/pricing";

export type CouponDoc = {
  _id: mongoose.Types.ObjectId; code: string; description: string; type: CouponType;
  /** percent: 1–100. fixed: minor units of the catalogue currency. free_shipping: unused (0). */
  value: number;
  maxDiscount: number | null; minSubtotal: number; startsAt: Date | null; expiresAt: Date | null;
  /** Total redemptions allowed across all customers (null = unlimited). */
  usageLimit: number | null; usedCount: number;
  /** Redemptions per customer email (null = unlimited). */
  perCustomerLimit: number | null; isActive: boolean; createdAt: Date; updatedAt: Date;
};
const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "", maxlength: 200 },
    type: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, required: true, min: 0, validate: Number.isInteger },
    maxDiscount: { type: Number, default: null, min: 1 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    perCustomerLimit: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
schema.index({ isActive: 1, createdAt: -1 });
if (process.env.NODE_ENV !== "production") delete mongoose.models.Coupon;
export const Coupon: Model<CouponDoc> = (mongoose.models.Coupon as Model<CouponDoc>) || mongoose.model<CouponDoc>("Coupon", schema as never);

/** Per-customer redemption counter, one document per coupon + customer email. `_id` = `${couponId}:${email}`. */
export type CouponUseDoc = { _id: string; coupon: mongoose.Types.ObjectId; count: number };
const useSchema = new mongoose.Schema({ _id: { type: String }, coupon: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, count: { type: Number, default: 0 } }, { versionKey: false });
if (process.env.NODE_ENV !== "production") delete mongoose.models.CouponUse;
export const CouponUse: Model<CouponUseDoc> = (mongoose.models.CouponUse as Model<CouponUseDoc>) || mongoose.model<CouponUseDoc>("CouponUse", useSchema as never);
