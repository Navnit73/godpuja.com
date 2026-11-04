import mongoose, { type InferSchemaType, type Model } from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    options: { type: Map, of: String, default: {} },
    price: Number, // paise; falls back to the product price
    salePrice: Number,
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    shortDescription: { type: String, default: "", maxlength: 300 },
    description: { type: String, default: "", maxlength: 20000 }, // Markdown, sanitised when rendered
    images: [{ _id: false, url: String, alt: String, order: Number }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    brand: { type: String, default: "", maxlength: 80 },
    price: { type: Number, required: true, min: 0 }, // integer paise
    salePrice: { type: Number, min: 0 },
    effectivePrice: { type: Number, default: 0, min: 0 }, // salePrice ?? price; denormalised for filter/sort
    stock: { type: Number, default: 0, min: 0 }, // used only when there are no variants
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    status: { type: String, enum: ["draft", "active", "upcoming", "archived"], default: "draft" },
    isFeatured: { type: Boolean, default: false },
    attributes: [{ _id: false, name: String, value: String }],
    variants: { type: [variantSchema], default: [] },
    shipping: {
      weightGrams: { type: Number, default: 0 }, length: { type: Number, default: 0 },
      width: { type: Number, default: 0 }, height: { type: Number, default: 0 }, freeShipping: { type: Boolean, default: false },
    },
    soldCount: { type: Number, default: 0 },
    // Published reviews only, kept in step with the review collection by reviews.ts (atomic increments).
    ratingCount: { type: Number, default: 0, min: 0 },
    ratingSum: { type: Number, default: 0, min: 0 },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    seo: {
      title: { type: String, default: "" }, description: { type: String, default: "" }, canonical: { type: String, default: "" },
      ogImage: { type: String, default: "" }, noindex: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);
productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, isFeatured: 1, createdAt: -1, _id: -1 });
productSchema.index({ status: 1, createdAt: -1, _id: -1 });
productSchema.index({ status: 1, soldCount: -1, _id: -1 });
productSchema.index({ status: 1, effectivePrice: 1 });
productSchema.index({ status: 1, ratingAvg: -1, ratingCount: -1, _id: -1 });
productSchema.index({ "variants.sku": 1 }, { unique: true, partialFilterExpression: { "variants.sku": { $type: "string" } } });
productSchema.index({ name: "text", shortDescription: "text", brand: "text" }, { weights: { name: 5, brand: 2, shortDescription: 1 } });
productSchema.index({ updatedAt: -1 });

export type ProductDoc = Omit<InferSchemaType<typeof productSchema>, "variants"> & {
  _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date;
  variants: { sku: string; options: Record<string, string>; price?: number | null; salePrice?: number | null; stock: number }[];
};
if (process.env.NODE_ENV !== "production") delete mongoose.models.Product;
export const Product: Model<ProductDoc> = (mongoose.models.Product as Model<ProductDoc>) || mongoose.model<ProductDoc>("Product", productSchema as never);
