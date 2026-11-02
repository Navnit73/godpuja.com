import mongoose, { type Model } from "mongoose";

// Shared fixed-window counters for security-sensitive limits (login, checkout...). One document per key per window;
// the TTL index removes it shortly after the window ends. Works across any number of server instances.
const schema = new mongoose.Schema(
  { _id: { type: String, required: true }, n: { type: Number, default: 0 }, expiresAt: { type: Date, required: true } },
  { versionKey: false },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type RateLimitDoc = { _id: string; n: number; expiresAt: Date };
if (process.env.NODE_ENV !== "production") delete mongoose.models.RateLimit;
export const RateLimit: Model<RateLimitDoc> = (mongoose.models.RateLimit as Model<RateLimitDoc>) || mongoose.model<RateLimitDoc>("RateLimit", schema as never);
