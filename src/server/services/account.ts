import mongoose from "mongoose";
import { ApiError } from "../api";
import { hashPassword, verifyPassword } from "../auth/password";
import { connectDB } from "../db";
import * as T from "../email/templates";
import { env } from "../env";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { normalizeRole } from "@/lib/roles";
import type { ProfileInput, SavedAddressInput } from "@/lib/validation/account";
import { MAX_ADDRESSES } from "@/lib/validation/account";
import { consumeToken, issueToken, revokeTokens } from "./auth-tokens";
import { defer, deliver, siteName } from "./notifications";
import { customerView, type CustomerOrder } from "./orders";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const isId = (id: string) => mongoose.isValidObjectId(id);

// ---------- registration & email verification ----------
export async function registerCustomer(input: { name: string; email: string; password: string }) {
  await connectDB();
  try {
    // Role is never read from the request: public sign-up is always a customer.
    const user = await User.create({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password), role: "customer" });
    const id = String(user._id);
    defer(() => sendVerification(id));
    return { id, name: user.name, email: user.email, role: "customer" as const };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError("CONFLICT", "An account with this email already exists", { email: "Already registered" });
    throw err;
  }
}

/** Email a fresh verification link (older links stop working). No-op for verified or unknown users. */
export async function sendVerification(userId: string): Promise<"sent" | "already_verified" | "skipped" | "failed" | "queued"> {
  await connectDB();
  const u = await User.findById(userId).select("name email emailVerifiedAt isActive").lean();
  if (!u || !u.isActive) return "skipped";
  if (u.emailVerifiedAt) return "already_verified";
  await revokeTokens(userId, "verify_email");
  const raw = await issueToken(userId, u.email, "verify_email");
  return deliver(T.verifyEmail(await siteName(), u.email, u.name, `${env().SITE_URL}/verify-email?token=${raw}`), "account.verify_email", { kind: "user", id: userId });
}

/** Attach past guest orders placed with this (now verified) email to the account. Returns how many were claimed. */
export async function claimGuestOrders(userId: string, email: string) {
  await connectDB();
  const res = await Order.updateMany({ email: email.toLowerCase(), user: null }, { $set: { user: oid(userId) } });
  return res.modifiedCount;
}

export async function verifyEmail(raw: string) {
  const t = await consumeToken(raw, "verify_email");
  if (!t) throw new ApiError("VALIDATION_ERROR", "This link is invalid or has expired. Request a new one from your account.", { token: "Invalid or expired" });
  await connectDB();
  // The link proves control of the address it was sent to; it is void if the account's email changed since.
  const u = await User.findOneAndUpdate({ _id: t.userId, email: t.email }, [{ $set: { emailVerifiedAt: { $ifNull: ["$emailVerifiedAt", "$$NOW"] } } }], { returnDocument: "after", updatePipeline: true }).lean();
  if (!u) throw new ApiError("VALIDATION_ERROR", "This link is no longer valid.", { token: "Invalid or expired" });
  const claimed = await claimGuestOrders(t.userId, u.email);
  return { userId: t.userId, claimed };
}

// ---------- password reset ----------
/** Always succeeds from the caller's point of view (no account enumeration). Only active accounts get an email. */
export async function requestPasswordReset(email: string) {
  await connectDB();
  const u = await User.findOne({ email }).select("name email isActive").lean();
  if (!u || !u.isActive) return;
  const id = String(u._id);
  defer(async () => {
    await revokeTokens(id, "password_reset");
    const raw = await issueToken(id, u.email, "password_reset");
    await deliver(T.passwordReset(await siteName(), u.email, u.name, `${env().SITE_URL}/reset-password?token=${raw}`), "account.password_reset", { kind: "user", id });
  });
}

/** Set a new password from an emailed token. Signs the user out everywhere and returns fresh session claims. */
export async function resetPassword(raw: string, password: string) {
  const t = await consumeToken(raw, "password_reset");
  if (!t) throw new ApiError("VALIDATION_ERROR", "This link is invalid or has expired. Request a new one.", { token: "Invalid or expired" });
  await connectDB();
  const passwordHash = await hashPassword(password);
  const u = await User.findOneAndUpdate(
    { _id: t.userId, email: t.email, isActive: true },
    // Pipeline update: user/hash strings must be $literal (a bcrypt hash starts with "$", which would read as a field path).
    [{ $set: { passwordHash: { $literal: passwordHash }, tokenVersion: { $add: [{ $ifNull: ["$tokenVersion", 0] }, 1] }, emailVerifiedAt: { $ifNull: ["$emailVerifiedAt", "$$NOW"] } } }],
    { returnDocument: "after", updatePipeline: true },
  ).select("role tokenVersion email").lean();
  if (!u) throw new ApiError("VALIDATION_ERROR", "This link is no longer valid.", { token: "Invalid or expired" });
  await revokeTokens(t.userId, "password_reset");
  await claimGuestOrders(t.userId, u.email); // the reset proved control of the email
  return { uid: t.userId, role: normalizeRole(u.role) ?? "customer", tv: u.tokenVersion ?? 0 };
}

// ---------- profile ----------
export type Profile = {
  id: string; name: string; email: string; phone: string; emailVerified: boolean; hasPassword: boolean; google: boolean;
  prefs: { country: string; language: string; currency: string; timezone: string }; createdAt: string;
};

export async function getProfile(userId: string): Promise<Profile> {
  await connectDB();
  const u = await User.findById(userId).select("+passwordHash name email phone emailVerifiedAt googleSub prefs createdAt").lean();
  if (!u) throw new ApiError("NOT_FOUND", "Account not found");
  return {
    id: userId, name: u.name, email: u.email, phone: u.phone ?? "", emailVerified: !!u.emailVerifiedAt, hasPassword: !!u.passwordHash, google: !!u.googleSub,
    prefs: { country: u.prefs?.country ?? "IN", language: u.prefs?.language ?? "en", currency: u.prefs?.currency ?? "INR", timezone: u.prefs?.timezone ?? "Asia/Kolkata" },
    createdAt: (u as { createdAt?: Date }).createdAt?.toISOString() ?? "",
  };
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<Profile> {
  await connectDB();
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.phone !== undefined) set.phone = input.phone;
  if (input.prefs) for (const [k, v] of Object.entries(input.prefs)) set[`prefs.${k}`] = v;
  await User.updateOne({ _id: userId }, { $set: set });
  return getProfile(userId);
}

/** Change (or, for Google-only accounts, set) the password. Signs out other sessions; returns fresh claims for this one. */
export async function changePassword(userId: string, current: string | undefined, next: string) {
  await connectDB();
  const u = await User.findById(userId).select("+passwordHash role").lean();
  if (!u) throw new ApiError("NOT_FOUND", "Account not found");
  if (u.passwordHash && !(await verifyPassword(current ?? "", u.passwordHash))) {
    throw new ApiError("VALIDATION_ERROR", "Your current password is not correct", { currentPassword: "Not correct" });
  }
  const res = await User.findOneAndUpdate({ _id: userId }, { $set: { passwordHash: await hashPassword(next) }, $inc: { tokenVersion: 1 } }, { returnDocument: "after" }).select("role tokenVersion").lean();
  return { uid: userId, role: normalizeRole(res!.role) ?? "customer", tv: res!.tokenVersion ?? 0 };
}

// ---------- saved addresses ----------
export type SavedAddress = SavedAddressInput & { id: string; isDefault: boolean };
type AddrRow = { _id: mongoose.Types.ObjectId; label?: string; name?: string; phone?: string; line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string; isDefault?: boolean };
const toSaved = (a: AddrRow): SavedAddress => ({
  id: String(a._id), label: a.label ?? "", name: a.name ?? "", phone: a.phone ?? "", line1: a.line1 ?? "", ...(a.line2 ? { line2: a.line2 } : {}),
  city: a.city ?? "", state: a.state ?? "", postalCode: a.postalCode ?? "", country: a.country ?? "IN", isDefault: !!a.isDefault,
});
const addrFields = (a: SavedAddressInput) => ({
  label: a.label ?? "", name: a.name, phone: a.phone ?? "", line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, postalCode: a.postalCode, country: a.country,
});

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  await connectDB();
  const u = await User.findById(userId).select("addresses").lean();
  if (!u) throw new ApiError("NOT_FOUND", "Account not found");
  return ((u.addresses ?? []) as AddrRow[]).map(toSaved).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

/** Add an address. The first one, or one marked default, becomes the default. Limited to MAX_ADDRESSES (atomic). */
export async function addAddress(userId: string, input: SavedAddressInput): Promise<SavedAddress[]> {
  await connectDB();
  const count = (await User.findById(userId).select("addresses").lean())?.addresses?.length ?? 0;
  const makeDefault = input.isDefault || count === 0;
  const res = await User.updateOne(
    { _id: userId, [`addresses.${MAX_ADDRESSES - 1}`]: { $exists: false } },
    [{ $set: { addresses: { $concatArrays: [
      makeDefault ? { $map: { input: { $ifNull: ["$addresses", []] }, as: "a", in: { $mergeObjects: ["$$a", { isDefault: false }] } } } : { $ifNull: ["$addresses", []] },
      // $literal: customer text such as "$5 Street" must never be read as a field path.
      [{ $literal: { _id: new mongoose.Types.ObjectId(), ...addrFields(input), isDefault: makeDefault } }],
    ] } } }],
    { updatePipeline: true },
  );
  if (res.matchedCount === 0) {
    if (!(await User.exists({ _id: userId }))) throw new ApiError("NOT_FOUND", "Account not found");
    throw new ApiError("CONFLICT", `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`);
  }
  return listAddresses(userId);
}

export async function updateAddress(userId: string, addressId: string, input: SavedAddressInput): Promise<SavedAddress[]> {
  if (!isId(addressId)) throw new ApiError("NOT_FOUND", "Address not found");
  await connectDB();
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(addrFields(input))) set[`addresses.$.${k}`] = v;
  const res = await User.updateOne({ _id: userId, "addresses._id": oid(addressId) }, { $set: set });
  if (res.matchedCount === 0) throw new ApiError("NOT_FOUND", "Address not found");
  if (input.isDefault) await setDefaultAddress(userId, addressId);
  return listAddresses(userId);
}

export async function setDefaultAddress(userId: string, addressId: string) {
  if (!isId(addressId)) throw new ApiError("NOT_FOUND", "Address not found");
  await connectDB();
  const res = await User.updateOne(
    { _id: userId, "addresses._id": oid(addressId) },
    [{ $set: { addresses: { $map: { input: "$addresses", as: "a", in: { $mergeObjects: ["$$a", { isDefault: { $eq: ["$$a._id", oid(addressId)] } }] } } } } }],
    { updatePipeline: true },
  );
  if (res.matchedCount === 0) throw new ApiError("NOT_FOUND", "Address not found");
  return listAddresses(userId);
}

/** Remove an address; if it was the default, the first remaining one becomes the default. */
export async function removeAddress(userId: string, addressId: string): Promise<SavedAddress[]> {
  if (!isId(addressId)) throw new ApiError("NOT_FOUND", "Address not found");
  await connectDB();
  // Match on the address itself: modifiedCount is useless here because timestamps always bump updatedAt.
  const res = await User.updateOne({ _id: userId, "addresses._id": oid(addressId) }, { $pull: { addresses: { _id: oid(addressId) } } });
  if (res.matchedCount === 0) throw new ApiError("NOT_FOUND", "Address not found");
  const left = await listAddresses(userId);
  if (left.length && !left.some((a) => a.isDefault)) return setDefaultAddress(userId, left[0].id);
  return left;
}

/** Save a checkout address unless the same one is already saved (best effort; the order never depends on it). */
export async function saveCheckoutAddress(userId: string, input: SavedAddressInput) {
  const existing = await listAddresses(userId);
  const same = (a: SavedAddress) => a.line1.toLowerCase() === input.line1.toLowerCase() && a.postalCode === input.postalCode && a.country === input.country && a.name.toLowerCase() === input.name.toLowerCase();
  if (existing.some(same) || existing.length >= MAX_ADDRESSES) return;
  await addAddress(userId, input);
}

// ---------- order history ----------
export type MyOrderListItem = { id: string; orderNumber: string; createdAt: string; status: CustomerOrder["status"]; currency: string; total: number; itemCount: number };

export async function listMyOrders(userId: string, page = 1, limit = 10) {
  await connectDB();
  const filter = { user: oid(userId) };
  const [rows, total] = await Promise.all([
    Order.find(filter).select("orderNumber createdAt status currency pricing.total items.qty").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  const items: MyOrderListItem[] = rows.map((o) => ({
    id: String(o._id), orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), status: o.status, currency: o.currency ?? "INR",
    total: o.pricing.total, itemCount: o.items.reduce((n, i) => n + i.qty, 0),
  }));
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** A customer's own order. Someone else's order and a missing one are indistinguishable (404). */
export async function getMyOrder(userId: string, orderId: string): Promise<CustomerOrder & { id: string }> {
  if (!isId(orderId)) throw new ApiError("NOT_FOUND", "Order not found");
  await connectDB();
  const o = await Order.findOne({ _id: orderId, user: oid(userId) }).lean();
  if (!o) throw new ApiError("NOT_FOUND", "Order not found");
  return { id: orderId, ...customerView(o) };
}
