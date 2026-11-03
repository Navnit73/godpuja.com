import mongoose, { type InferSchemaType, type Model } from "mongoose";

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["richtext", "imageText"], required: true },
    enabled: { type: Boolean, default: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const pageSchema = new mongoose.Schema(
  {
    // Missing on documents created before blog/guides existed; those are treated as "page".
    kind: { type: String, enum: ["page", "blog", "guide"], default: "page" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", maxlength: 300 },
    coverImageUrl: { type: String, default: "" },
    coverImageAlt: { type: String, default: "" },
    sections: { type: [sectionSchema], default: [] },
    status: { type: String, enum: ["draft", "published", "scheduled"], default: "draft", index: true },
    publishAt: Date,
    publishedAt: Date,
    previewToken: { type: String, required: true, unique: true },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      canonical: { type: String, default: "" },
      ogImage: { type: String, default: "" },
      noindex: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);
pageSchema.index({ status: 1, publishAt: 1 });
pageSchema.index({ updatedAt: -1 });
pageSchema.index({ kind: 1, status: 1, publishedAt: -1 }); // blog / guide listings, newest first

export type PageDoc = InferSchemaType<typeof pageSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };

if (process.env.NODE_ENV !== "production") delete mongoose.models.Page;
export const Page: Model<PageDoc> = (mongoose.models.Page as Model<PageDoc>) || mongoose.model<PageDoc>("Page", pageSchema);
