import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { ROLES, type Role } from "@/lib/roles";
export { ROLES };
export type { Role };

const addressSchema = new mongoose.Schema(
  {
    label: String,
    name: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: "IN" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "customer", index: true },
    phone: { type: String, trim: true },
    addresses: [addressSchema],
    isActive: { type: Boolean, default: true },
    /** Incremented on role/active/password change; sessions with an older value are rejected. */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

// In dev, HMR keeps the previously compiled model (with the old schema); drop it so schema edits apply.
if (process.env.NODE_ENV !== "production") delete mongoose.models.User;

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);
