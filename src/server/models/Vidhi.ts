import mongoose, { type Model } from "mongoose";
import { VIDHI_CATEGORY_KEYS, type VidhiCategory } from "@/lib/validation/vidhi";

/**
 * A Pooja Vidhi guide (PRD v1.1 §8): structured ritual content with a samagri list, steps and mantras, an author and a
 * reviewer, and the same draft / schedule / publish / preview workflow as CMS pages.
 */
export type VidhiDoc = {
  _id: mongoose.Types.ObjectId; title: string; slug: string; category: VidhiCategory; deity: string;
  summary: string; significance: string; preparation: string; body: string;
  samagri: { item: string; quantity: string; note: string; productSlug: string }[];
  steps: { title: string; body: string; mantra: string }[];
  mantras: { title: string; text: string; meaning: string }[];
  relatedAarti: string[]; relatedProducts: string[]; relatedVidhi: string[]; tags: string[]; durationMinutes: number | null;
  coverImageUrl: string; coverImageAlt: string; author: string; reviewer: string; reviewedAt: Date | null;
  status: "draft" | "published" | "scheduled"; publishAt?: Date | null; publishedAt?: Date | null; previewToken: string;
  seo: { title: string; description: string; canonical: string; ogImage: string; noindex: boolean };
  createdAt: Date; updatedAt: Date;
};
const text = (max: number) => ({ type: String, default: "", maxlength: max });
const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, enum: VIDHI_CATEGORY_KEYS, required: true },
    deity: text(60),
    summary: text(2000), significance: text(5000), preparation: text(5000), body: text(20_000),
    samagri: { type: [{ _id: false, item: String, quantity: String, note: String, productSlug: String }], default: [] },
    steps: { type: [{ _id: false, title: String, body: String, mantra: String }], default: [] },
    mantras: { type: [{ _id: false, title: String, text: String, meaning: String }], default: [] },
    relatedAarti: { type: [String], default: [] }, relatedProducts: { type: [String], default: [] }, relatedVidhi: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    durationMinutes: { type: Number, default: null },
    coverImageUrl: text(2000), coverImageAlt: text(200),
    author: text(80), reviewer: text(80), reviewedAt: { type: Date, default: null },
    status: { type: String, enum: ["draft", "published", "scheduled"], default: "draft", index: true },
    publishAt: Date, publishedAt: Date,
    previewToken: { type: String, required: true, unique: true },
    seo: { title: text(70), description: text(300), canonical: text(2000), ogImage: text(2000), noindex: { type: Boolean, default: false } },
  },
  { timestamps: true },
);
schema.index({ status: 1, category: 1, publishedAt: -1 });
schema.index({ status: 1, publishAt: 1 });
schema.index({ tags: 1 });
schema.index({ title: "text", summary: "text", deity: "text", tags: "text" }, { weights: { title: 5, deity: 3, tags: 2, summary: 1 } });
if (process.env.NODE_ENV !== "production") delete mongoose.models.Vidhi;
export const Vidhi: Model<VidhiDoc> = (mongoose.models.Vidhi as Model<VidhiDoc>) || mongoose.model<VidhiDoc>("Vidhi", schema as never);
