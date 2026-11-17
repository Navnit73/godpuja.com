import mongoose, { type Model } from "mongoose";
import { AUDIO_LICENCE_KEYS, DEVOTIONAL_LANGUAGE_KEYS, DEVOTIONAL_TYPE_KEYS, type AudioLicence, type DevotionalLanguage, type DevotionalType } from "@/lib/validation/devotional";

/** An aarti, mantra, chalisa or stotra (PRD v1.1 §9) with optional audio and the rights record that decides whether it may play. */
export type DevotionalDoc = {
  _id: mongoose.Types.ObjectId; title: string; slug: string; type: DevotionalType; deity: string; language: DevotionalLanguage;
  lyrics: string; transliteration: string; meaning: string; summary: string;
  audioUrl: string; audioDurationSeconds: number | null;
  rights: { source: string; licence: AudioLicence | ""; reference: string; expiresAt: Date | null; withdrawn: boolean };
  relatedAarti: string[]; relatedVidhi: string[]; relatedProducts: string[]; tags: string[];
  coverImageUrl: string; coverImageAlt: string; reviewer: string; reviewedAt: Date | null;
  status: "draft" | "published" | "scheduled"; publishAt?: Date | null; publishedAt?: Date | null; previewToken: string;
  seo: { title: string; description: string; canonical: string; ogImage: string; noindex: boolean };
  createdAt: Date; updatedAt: Date;
};
const text = (max: number) => ({ type: String, default: "", maxlength: max });
const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: DEVOTIONAL_TYPE_KEYS, required: true },
    deity: text(60),
    language: { type: String, enum: DEVOTIONAL_LANGUAGE_KEYS, default: "sanskrit" },
    lyrics: text(30_000), transliteration: text(30_000), meaning: text(10_000), summary: text(500),
    audioUrl: text(2000), audioDurationSeconds: { type: Number, default: null },
    rights: {
      source: text(200), licence: { type: String, enum: [...AUDIO_LICENCE_KEYS, ""], default: "" }, reference: text(500),
      expiresAt: { type: Date, default: null }, withdrawn: { type: Boolean, default: false },
    },
    relatedAarti: { type: [String], default: [] }, relatedVidhi: { type: [String], default: [] }, relatedProducts: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    coverImageUrl: text(2000), coverImageAlt: text(200),
    reviewer: text(80), reviewedAt: { type: Date, default: null },
    status: { type: String, enum: ["draft", "published", "scheduled"], default: "draft", index: true },
    publishAt: Date, publishedAt: Date,
    previewToken: { type: String, required: true, unique: true },
    seo: { title: text(70), description: text(300), canonical: text(2000), ogImage: text(2000), noindex: { type: Boolean, default: false } },
  },
  { timestamps: true },
);
schema.index({ status: 1, type: 1, publishedAt: -1 });
schema.index({ status: 1, publishAt: 1 });
schema.index({ deity: 1, language: 1 });
schema.index({ "rights.expiresAt": 1 });
schema.index({ title: "text", summary: "text", deity: "text", tags: "text" }, { weights: { title: 5, deity: 3, tags: 2, summary: 1 }, default_language: "none", language_override: "textLanguage" }); // our own `language` field must not be read as a MongoDB text-search language
if (process.env.NODE_ENV !== "production") delete mongoose.models.Devotional;
export const Devotional: Model<DevotionalDoc> = (mongoose.models.Devotional as Model<DevotionalDoc>) || mongoose.model<DevotionalDoc>("Devotional", schema as never);
