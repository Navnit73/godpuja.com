import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { LEGACY_ROLES, ROLES, type Role } from "@/lib/roles";
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
    postalCode: String,
    country: { type: String, default: "IN" }, // ISO 3166-1 alpha-2
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Optional since Stage 13: accounts created with Google have no password until they set one (forgot password).
    passwordHash: { type: String, select: false },
    /** Set when the user proved control of `email` (link in email, password reset, or Google with email_verified). */
    emailVerifiedAt: { type: Date, default: null },
    /** Google account id (OIDC `sub`). Unique when present. */
    googleSub: { type: String },
    /** PRD v1.1 §11. Currency is display-only until multi-currency (Phase 3). */
    prefs: {
      country: { type: String, default: "IN" }, // ISO 3166-1 alpha-2
      language: { type: String, default: "en" },
      currency: { type: String, default: "INR" }, // ISO 4217
      timezone: { type: String, default: "Asia/Kolkata" }, // IANA
    },
    // Legacy names stay valid until scripts/migrate-stage12.ts rewrites them; normalizeRole() maps them on read.
    role: { type: String, enum: [...ROLES, ...Object.keys(LEGACY_ROLES)], default: "customer", index: true },
    /** Temples a scoped role (temple_operator) may manage. Ignored for other roles. PRD v1.1 §12. */
    templeIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    phone: { type: String, trim: true },
    addresses: [addressSchema],
    isActive: { type: Boolean, default: true },
    /** Incremented on role/active/password change; sessions with an older value are rejected. */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true },
);
userSchema.index({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: "string" } } });

export type UserDoc = Omit<InferSchemaType<typeof userSchema>, "role"> & { _id: mongoose.Types.ObjectId; role: Role | keyof typeof LEGACY_ROLES };

// In dev, HMR keeps the previously compiled model (with the old schema); drop it so schema edits apply.
if (process.env.NODE_ENV !== "production") delete mongoose.models.User;

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);
