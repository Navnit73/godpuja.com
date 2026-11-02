import mongoose, { type InferSchemaType, type Model } from "mongoose";

const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    source: { type: String, default: "footer", maxlength: 40 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type SubscriberDoc = InferSchemaType<typeof subscriberSchema>;

if (process.env.NODE_ENV !== "production") delete mongoose.models.Subscriber;
export const Subscriber: Model<SubscriberDoc> = (mongoose.models.Subscriber as Model<SubscriberDoc>) || mongoose.model<SubscriberDoc>("Subscriber", subscriberSchema);
