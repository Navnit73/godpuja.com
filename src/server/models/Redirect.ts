import mongoose, { type InferSchemaType, type Model } from "mongoose";

// 301 table consulted by the proxy in Stage 10. Written whenever a public URL (category path / product slug) changes.
const redirectSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, unique: true, maxlength: 400 }, // normalised path, e.g. "/product/old-slug"
    to: { type: String, required: true, maxlength: 400 },
    code: { type: Number, enum: [301, 302], default: 301 },
    hits: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type RedirectDoc = InferSchemaType<typeof redirectSchema>;
if (process.env.NODE_ENV !== "production") delete mongoose.models.Redirect;
export const Redirect: Model<RedirectDoc> = (mongoose.models.Redirect as Model<RedirectDoc>) || mongoose.model<RedirectDoc>("Redirect", redirectSchema);
