import mongoose, { type ClientSession } from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Coupon, CouponUse, type CouponDoc } from "../models/Coupon";
import { formatMoney } from "@/lib/money";
import { computeDiscount, type CouponType, type Discount } from "@/lib/pricing";
import type { CouponInput } from "@/lib/validation/coupons";

const isId = (id: string) => mongoose.isValidObjectId(id);
const dupKey = (e: unknown) => (e as { code?: number })?.code === 11000;
const iso = (d?: Date | null) => (d ? d.toISOString() : null);

// ---------- checking a code against a cart ----------
export type AppliedCoupon = { id: string; code: string; type: CouponType; discount: Discount };

/**
 * Why a code cannot be used right now, or null if it can. Unknown and switched-off codes get the same answer, so
 * codes cannot be probed. Per-customer limits are checked when the order is placed (the email is not known earlier).
 */
export function couponProblem(c: Pick<CouponDoc, "isActive" | "startsAt" | "expiresAt" | "minSubtotal" | "usageLimit" | "usedCount"> | null, subtotal: number, now = new Date()): string | null {
  if (!c || !c.isActive) return "This code is not valid.";
  if (c.startsAt && now < c.startsAt) return "This code is not active yet.";
  if (c.expiresAt && now >= c.expiresAt) return "This code has expired.";
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return "This code has been fully used.";
  if (subtotal < c.minSubtotal) return `Spend at least ${formatMoney(c.minSubtotal)} to use this code.`;
  return null;
}

type Terms = Pick<CouponDoc, "_id" | "code" | "type" | "value" | "maxDiscount">;
export const applyTerms = (c: Terms, subtotal: number, shipping: number): AppliedCoupon => ({ id: String(c._id), code: c.code, type: c.type, discount: computeDiscount(c, subtotal, shipping) });

/** Look a code up for the cart (no side effects). `{ coupon }` or `{ error }` with a customer-facing message. */
export async function checkCoupon(code: string, subtotal: number, shipping: number, session?: ClientSession): Promise<{ coupon: AppliedCoupon; doc: CouponDoc } | { error: string }> {
  await connectDB();
  const doc = await Coupon.findOne({ code: code.trim().toUpperCase() }).session(session ?? null).lean();
  const problem = couponProblem(doc as never, subtotal);
  if (problem || !doc) return { error: problem ?? "This code is not valid." };
  return { coupon: applyTerms(doc, subtotal, shipping), doc };
}

// ---------- redeeming (inside the checkout transaction) ----------
const counterKey = (couponId: unknown, email: string) => `${String(couponId)}:${email.trim().toLowerCase()}`;
const LIMIT_MESSAGE = (what: string) => new ApiError("CONFLICT", what, { couponCode: what });

/**
 * Count one use. Both limits are enforced with a guarded atomic update, so concurrent checkouts can never exceed them:
 * the global counter only increments while below the limit; the per-customer counter is an upsert guarded the same way
 * (a failed guard makes the upsert collide on _id, which means "limit reached"). Throws if either limit is reached,
 * which aborts the whole order transaction.
 */
export async function redeemCoupon(doc: Pick<CouponDoc, "_id" | "usageLimit" | "perCustomerLimit">, email: string, session: ClientSession) {
  const g = await Coupon.updateOne(
    { _id: doc._id, isActive: true, ...(doc.usageLimit != null ? { usedCount: { $lt: doc.usageLimit } } : {}) },
    { $inc: { usedCount: 1 } }, { session, timestamps: false },
  );
  if (g.matchedCount === 0) throw LIMIT_MESSAGE("This code has been fully used.");
  if (doc.perCustomerLimit != null) {
    try {
      await CouponUse.updateOne({ _id: counterKey(doc._id, email), count: { $lt: doc.perCustomerLimit } }, { $inc: { count: 1 }, $setOnInsert: { coupon: doc._id } }, { upsert: true, session });
    } catch (e) {
      if (dupKey(e)) throw LIMIT_MESSAGE("You have already used this code.");
      throw e;
    }
  }
}

/** Give a use back (order cancelled before it shipped). Never goes below zero. */
export async function releaseCoupon(couponId: mongoose.Types.ObjectId | string, email: string, session: ClientSession) {
  await Coupon.updateOne({ _id: couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session, timestamps: false });
  await CouponUse.updateOne({ _id: counterKey(couponId, email), count: { $gt: 0 } }, { $inc: { count: -1 } }, { session });
}

// ---------- admin ----------
/** `live` can be used now; `scheduled` has not started; `expired` has ended; `off` is switched off. Computed on the server at read time. */
export type CouponState = "live" | "scheduled" | "expired" | "off";
export type AdminCoupon = Omit<CouponInput, "startsAt" | "expiresAt"> & { id: string; state: CouponState; usedCount: number; startsAt: string | null; expiresAt: string | null; createdAt: string; updatedAt: string };
const stateOf = (c: CouponDoc, now = new Date()): CouponState =>
  !c.isActive ? "off" : c.expiresAt && now >= c.expiresAt ? "expired" : c.startsAt && now < c.startsAt ? "scheduled" : "live";
const toAdmin = (c: CouponDoc): AdminCoupon => ({
  id: String(c._id), state: stateOf(c), code: c.code, description: c.description ?? "", type: c.type, value: c.value, maxDiscount: c.maxDiscount ?? null, minSubtotal: c.minSubtotal ?? 0,
  startsAt: iso(c.startsAt), expiresAt: iso(c.expiresAt), usageLimit: c.usageLimit ?? null, usedCount: c.usedCount ?? 0, perCustomerLimit: c.perCustomerLimit ?? null,
  isActive: c.isActive, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
});

export async function listCoupons(): Promise<AdminCoupon[]> {
  await connectDB();
  return (await Coupon.find().sort({ createdAt: -1, _id: -1 }).limit(500).lean()).map(toAdmin);
}

export async function getCoupon(id: string): Promise<AdminCoupon> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Coupon not found");
  await connectDB();
  const c = await Coupon.findById(id).lean();
  if (!c) throw new ApiError("NOT_FOUND", "Coupon not found");
  return toAdmin(c);
}

const dates = (i: CouponInput) => ({ startsAt: i.startsAt ? new Date(i.startsAt) : null, expiresAt: i.expiresAt ? new Date(i.expiresAt) : null });

export async function createCoupon(input: CouponInput): Promise<AdminCoupon> {
  await connectDB();
  try {
    const c = await Coupon.create({ ...input, ...dates(input) });
    return toAdmin(c.toObject() as CouponDoc);
  } catch (e) {
    if (dupKey(e)) throw new ApiError("CONFLICT", "A coupon with this code already exists", { code: "Already in use" });
    throw e;
  }
}

/** The code is fixed once created (orders and counters refer to it). Optimistic concurrency like the other admin editors. */
export async function updateCoupon(id: string, input: CouponInput & { baseUpdatedAt: string }): Promise<AdminCoupon> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Coupon not found");
  await connectDB();
  const { baseUpdatedAt, code, ...rest } = input;
  // The code is part of the match: a request that tries to rename the coupon matches nothing and is refused below.
  const res = await Coupon.findOneAndUpdate({ _id: id, code, updatedAt: new Date(baseUpdatedAt) }, { $set: { ...rest, ...dates(input) } }, { returnDocument: "after" }).lean();
  if (res) return toAdmin(res);
  const cur = await Coupon.findById(id).select("code").lean();
  if (!cur) throw new ApiError("NOT_FOUND", "Coupon not found");
  if (cur.code !== code) throw new ApiError("VALIDATION_ERROR", "The code cannot be changed. Create a new coupon instead.", { code: "Cannot be changed" });
  throw new ApiError("CONFLICT", "This coupon was changed by someone else. Reload and try again.");
}

/** Orders keep their own copy of the code and amount, so a coupon can be deleted at any time. */
export async function deleteCoupon(id: string) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Coupon not found");
  await connectDB();
  const res = await Coupon.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw new ApiError("NOT_FOUND", "Coupon not found");
  await CouponUse.deleteMany({ coupon: new mongoose.Types.ObjectId(id) });
}
