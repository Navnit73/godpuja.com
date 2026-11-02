import mongoose, { type InferSchemaType, type Model } from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    path: { type: String, required: true, unique: true }, // "puja-kits/diwali"; unique also makes sibling slugs unique
    level: { type: Number, required: true, min: 1, max: 3 },
    description: { type: String, default: "", maxlength: 1000 },
    image: { url: { type: String, default: "" }, alt: { type: String, default: "" } },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    treeVersion: { type: Number, default: 0 }, // bumped on structural changes below/around a node; see services/categories.ts
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
categorySchema.index({ parent: 1, order: 1 });
categorySchema.index({ isActive: 1 });

export type CategoryDoc = InferSchemaType<typeof categorySchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
if (process.env.NODE_ENV !== "production") delete mongoose.models.Category;
export const Category: Model<CategoryDoc> = (mongoose.models.Category as Model<CategoryDoc>) || mongoose.model<CategoryDoc>("Category", categorySchema);
