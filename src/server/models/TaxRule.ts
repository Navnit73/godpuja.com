import mongoose, { type Model } from "mongoose";

/** One rule per destination country (ISO 3166-1 alpha-2). No rule for a country = no tax line for it. */
export type TaxRuleDoc = {
  _id: mongoose.Types.ObjectId; country: string; name: string;
  /** Hundredths of a percent: 1800 = 18%. */
  rateBps: number;
  /** true: catalogue prices already contain this tax (reported, not added). false: added on top at checkout. */
  inclusive: boolean; appliesToShipping: boolean; isActive: boolean; createdAt: Date; updatedAt: Date;
};
const schema = new mongoose.Schema(
  {
    country: { type: String, required: true, unique: true, uppercase: true, match: /^[A-Z]{2}$/ },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    rateBps: { type: Number, required: true, min: 0, max: 10_000, validate: Number.isInteger },
    inclusive: { type: Boolean, default: true },
    appliesToShipping: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
if (process.env.NODE_ENV !== "production") delete mongoose.models.TaxRule;
export const TaxRule: Model<TaxRuleDoc> = (mongoose.models.TaxRule as Model<TaxRuleDoc>) || mongoose.model<TaxRuleDoc>("TaxRule", schema as never);
