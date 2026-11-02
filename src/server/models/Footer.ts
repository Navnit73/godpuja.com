import mongoose, { type Model } from "mongoose";
import type { FooterInput } from "@/lib/validation/footer";

// Singleton document (key "main"). Shape is enforced by zod at the API boundary.
const footerSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    columns: { type: mongoose.Schema.Types.Mixed, default: [] },
    social: { type: mongoose.Schema.Types.Mixed, default: [] },
    contact: { type: mongoose.Schema.Types.Mixed, default: {} },
    newsletter: { type: mongoose.Schema.Types.Mixed, default: {} },
    legalLinks: { type: mongoose.Schema.Types.Mixed, default: [] },
    copyright: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true, minimize: false },
);

export type FooterDoc = FooterInput & { _id: mongoose.Types.ObjectId; key: string; createdAt: Date; updatedAt: Date };

if (process.env.NODE_ENV !== "production") delete mongoose.models.Footer;
export const Footer: Model<FooterDoc> = (mongoose.models.Footer as Model<FooterDoc>) || mongoose.model<FooterDoc>("Footer", footerSchema as never);
