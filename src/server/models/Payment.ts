import mongoose, { type Model } from "mongoose";

/**
 * Immutable payment ledger (PRD v1.1 §14.1, §15.1). One row per money movement: a charge or a refund. Rows are never
 * updated; corrections are new rows. Product orders, pooja bookings and donations are separate `kind`s so they can be
 * reported separately. Amounts are integer minor units of `currency`.
 */
export const LEDGER_KINDS = ["order", "booking", "donation"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export type PaymentDoc = {
  _id: mongoose.Types.ObjectId;
  kind: LedgerKind; refId: mongoose.Types.ObjectId; refNumber: string;
  type: "charge" | "refund";
  provider: string; method: string; providerRef: string | null;
  amount: number; currency: string; fee: number; tax: number; net: number;
  note: string; actor: { id: string | null; name: string };
  createdAt: Date;
};
const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: LEDGER_KINDS, required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    refNumber: { type: String, required: true },
    type: { type: String, enum: ["charge", "refund"], required: true },
    provider: { type: String, required: true },
    method: { type: String, required: true },
    providerRef: { type: String, default: null },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    fee: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    tax: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    net: { type: Number, required: true, validate: Number.isInteger },
    note: { type: String, default: "" },
    actor: { id: { type: String, default: null }, name: { type: String, required: true } },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
schema.index({ kind: 1, refId: 1, createdAt: 1 });
schema.index({ kind: 1, createdAt: -1 });
// A provider transaction is recorded once per type, even if its webhook is delivered twice.
schema.index({ provider: 1, providerRef: 1, type: 1 }, { unique: true, partialFilterExpression: { providerRef: { $type: "string" } } });
// Immutable: block every update path at the model level.
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"] as const) {
  schema.pre(op, function () { throw new Error("Payment ledger rows are immutable"); });
}
if (process.env.NODE_ENV !== "production") delete mongoose.models.Payment;
export const Payment: Model<PaymentDoc> = (mongoose.models.Payment as Model<PaymentDoc>) || mongoose.model<PaymentDoc>("Payment", schema as never);
