import mongoose, { type InferSchemaType, type Model } from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true, unique: true },
    filename: { type: String, required: true, maxlength: 200 },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    width: Number,
    height: Number,
    alt: { type: String, default: "", maxlength: 200 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
mediaSchema.index({ createdAt: -1 });

export type MediaDoc = InferSchemaType<typeof mediaSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
if (process.env.NODE_ENV !== "production") delete mongoose.models.Media;
export const Media: Model<MediaDoc> = (mongoose.models.Media as Model<MediaDoc>) || mongoose.model<MediaDoc>("Media", mediaSchema);
