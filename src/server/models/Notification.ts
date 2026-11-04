import mongoose, { type Model } from "mongoose";

export const NOTIFICATION_STATES = ["queued", "sent", "failed", "skipped"] as const;
export type NotificationState = (typeof NOTIFICATION_STATES)[number];

/**
 * Delivery log for every notification (PRD v1.1 §15 "Notifications"). Stores the template and a reference to the
 * record, not the message body, so personal data and one-time links are not kept here.
 */
export type NotificationDoc = {
  _id: mongoose.Types.ObjectId; channel: "email"; to: string; template: string; subject: string;
  ref: { kind: string; id: string } | null; state: NotificationState; provider: string; providerId: string; error: string;
  createdAt: Date; updatedAt: Date;
};
const schema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["email"], default: "email" },
    to: { type: String, required: true },
    template: { type: String, required: true },
    subject: { type: String, required: true },
    ref: { type: { kind: String, id: String, _id: false }, default: null },
    state: { type: String, enum: NOTIFICATION_STATES, default: "queued" },
    provider: { type: String, default: "" },
    providerId: { type: String, default: "" },
    error: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ "ref.kind": 1, "ref.id": 1, createdAt: -1 });
schema.index({ state: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }); // keep one year
if (process.env.NODE_ENV !== "production") delete mongoose.models.Notification;
export const Notification: Model<NotificationDoc> = (mongoose.models.Notification as Model<NotificationDoc>) || mongoose.model<NotificationDoc>("Notification", schema as never);
