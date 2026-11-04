import mongoose, { type Model } from "mongoose";

export const AUTH_TOKEN_KINDS = ["verify_email", "password_reset"] as const;
export type AuthTokenKind = (typeof AUTH_TOKEN_KINDS)[number];

/**
 * Single-use, expiring tokens sent by email. Only a SHA-256 hash is stored, so a database leak does not reveal
 * usable links. Expired rows are removed by the TTL index.
 */
export type AuthTokenDoc = {
  _id: mongoose.Types.ObjectId; user: mongoose.Types.ObjectId; kind: AuthTokenKind; tokenHash: string; email: string;
  expiresAt: Date; usedAt: Date | null; createdAt: Date;
};
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: AUTH_TOKEN_KINDS, required: true },
    tokenHash: { type: String, required: true, unique: true },
    email: { type: String, required: true }, // the address the link was sent to; a later email change invalidates it
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ user: 1, kind: 1 });
if (process.env.NODE_ENV !== "production") delete mongoose.models.AuthToken;
export const AuthToken: Model<AuthTokenDoc> = (mongoose.models.AuthToken as Model<AuthTokenDoc>) || mongoose.model<AuthTokenDoc>("AuthToken", schema as never);
