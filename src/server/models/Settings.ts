import mongoose, { type InferSchemaType, type Model } from "mongoose";

// Singleton (key "main"): site-wide SEO defaults. Edited on /admin/seo.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    siteName: { type: String, default: "GodPuja" },
    defaultTitle: { type: String, default: "" },
    defaultDescription: { type: String, default: "" },
    defaultOgImage: { type: String, default: "" },
    twitterHandle: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    homeTitle: { type: String, default: "" },
    homeDescription: { type: String, default: "" },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
if (process.env.NODE_ENV !== "production") delete mongoose.models.Settings;
export const Settings: Model<SettingsDoc> = (mongoose.models.Settings as Model<SettingsDoc>) || mongoose.model<SettingsDoc>("Settings", settingsSchema);
