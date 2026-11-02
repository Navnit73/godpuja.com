import mongoose, { type Model } from "mongoose";
import type { HomeSection } from "@/lib/validation/homepage";

// Singleton document (key "main"). Section shapes are enforced by zod at the API boundary; order = array order.
const homepageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    sections: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { timestamps: true, minimize: false },
);

export type HomepageDoc = { _id: mongoose.Types.ObjectId; key: string; sections: HomeSection[]; createdAt: Date; updatedAt: Date };
if (process.env.NODE_ENV !== "production") delete mongoose.models.Homepage;
export const Homepage: Model<HomepageDoc> = (mongoose.models.Homepage as Model<HomepageDoc>) || mongoose.model<HomepageDoc>("Homepage", homepageSchema as never);
