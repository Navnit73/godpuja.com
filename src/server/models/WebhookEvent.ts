import mongoose, { type Model } from "mongoose";

// One row per processed provider event id: the unique index is what makes webhook handling idempotent.
const schema = new mongoose.Schema(
  { provider: { type: String, required: true }, eventId: { type: String, required: true }, type: String, order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" } },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ provider: 1, eventId: 1 }, { unique: true });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // keep 90 days, longer than any gateway retry window
export type WebhookEventDoc = { provider: string; eventId: string; type?: string; order?: mongoose.Types.ObjectId };
if (process.env.NODE_ENV !== "production") delete mongoose.models.WebhookEvent;
export const WebhookEvent: Model<WebhookEventDoc> = (mongoose.models.WebhookEvent as Model<WebhookEventDoc>) || mongoose.model<WebhookEventDoc>("WebhookEvent", schema as never);
