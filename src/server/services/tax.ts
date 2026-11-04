import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { TaxRule, type TaxRuleDoc } from "../models/TaxRule";
import type { TaxTerms } from "@/lib/pricing";
import type { TaxRuleInput } from "@/lib/validation/coupons";

const isId = (id: string) => mongoose.isValidObjectId(id);
const dupKey = (e: unknown) => (e as { code?: number })?.code === 11000;

/** The active rule for a destination country, or null (no tax line for that country). */
export async function taxTermsFor(country: string | undefined, session?: mongoose.ClientSession): Promise<TaxTerms | null> {
  if (!country) return null;
  await connectDB();
  const r = await TaxRule.findOne({ country: country.toUpperCase(), isActive: true }).session(session ?? null).lean();
  return r ? { name: r.name, rateBps: r.rateBps, inclusive: r.inclusive, appliesToShipping: r.appliesToShipping } : null;
}

export type AdminTaxRule = TaxRuleInput & { id: string; updatedAt: string };
const toAdmin = (r: TaxRuleDoc): AdminTaxRule => ({ id: String(r._id), country: r.country, name: r.name, rateBps: r.rateBps, inclusive: r.inclusive, appliesToShipping: r.appliesToShipping, isActive: r.isActive, updatedAt: r.updatedAt.toISOString() });

export async function listTaxRules(): Promise<AdminTaxRule[]> {
  await connectDB();
  return (await TaxRule.find().sort({ country: 1 }).lean()).map(toAdmin);
}

export async function createTaxRule(input: TaxRuleInput): Promise<AdminTaxRule> {
  await connectDB();
  try { return toAdmin((await TaxRule.create(input)).toObject() as TaxRuleDoc); }
  catch (e) {
    if (dupKey(e)) throw new ApiError("CONFLICT", "This country already has a tax rule. Edit it instead.", { country: "Already has a rule" });
    throw e;
  }
}

export async function updateTaxRule(id: string, input: TaxRuleInput & { baseUpdatedAt: string }): Promise<AdminTaxRule> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Tax rule not found");
  await connectDB();
  const { baseUpdatedAt, country, ...rest } = input;
  const res = await TaxRule.findOneAndUpdate({ _id: id, updatedAt: new Date(baseUpdatedAt), country }, { $set: rest }, { returnDocument: "after" }).lean();
  if (res) return toAdmin(res);
  const cur = await TaxRule.findById(id).select("country").lean();
  if (!cur) throw new ApiError("NOT_FOUND", "Tax rule not found");
  if (cur.country !== country) throw new ApiError("VALIDATION_ERROR", "The country cannot be changed. Create a new rule instead.", { country: "Cannot be changed" });
  throw new ApiError("CONFLICT", "This rule was changed by someone else. Reload and try again.");
}

/** Past orders keep their own tax figures, so a rule can be deleted at any time. */
export async function deleteTaxRule(id: string) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Tax rule not found");
  await connectDB();
  if ((await TaxRule.deleteOne({ _id: id })).deletedCount === 0) throw new ApiError("NOT_FOUND", "Tax rule not found");
}
