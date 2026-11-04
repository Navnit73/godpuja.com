import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "../db";
import { AuthToken, type AuthTokenKind } from "../models/AuthToken";

const TTL_MS: Record<AuthTokenKind, number> = { verify_email: 24 * 3600_000, password_reset: 3600_000 };
const sha = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

/** Create a single-use token for `user` and return the raw value (only ever sent by email, never stored). */
export async function issueToken(userId: string, email: string, kind: AuthTokenKind): Promise<string> {
  await connectDB();
  const raw = crypto.randomBytes(32).toString("base64url");
  await AuthToken.create({ user: new mongoose.Types.ObjectId(userId), kind, email, tokenHash: sha(raw), expiresAt: new Date(Date.now() + TTL_MS[kind]) });
  return raw;
}

/** Atomically mark a token used. Returns its owner, or null if unknown, expired, already used, or the wrong kind. */
export async function consumeToken(raw: string, kind: AuthTokenKind): Promise<{ userId: string; email: string } | null> {
  if (!TOKEN_PATTERN.test(raw)) return null;
  await connectDB();
  const now = new Date();
  const t = await AuthToken.findOneAndUpdate(
    { tokenHash: sha(raw), kind, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: "after" },
  ).lean();
  return t ? { userId: String(t.user), email: t.email } : null;
}

/** Invalidate a user's outstanding tokens of a kind (a new link replaces older ones; a reset kills other resets). */
export async function revokeTokens(userId: string, kind: AuthTokenKind) {
  await connectDB();
  await AuthToken.updateMany({ user: new mongoose.Types.ObjectId(userId), kind, usedAt: null }, { $set: { usedAt: new Date() } });
}
