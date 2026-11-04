import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import { connectDB } from "../db";
import { Payment, type LedgerKind, type PaymentDoc } from "../models/Payment";

export type LedgerEntry = {
  kind: LedgerKind; refId: string | mongoose.Types.ObjectId; refNumber: string; type: "charge" | "refund";
  provider: string; method: string; providerRef?: string | null; amount: number; currency: string;
  fee?: number; tax?: number; note?: string; actor: { id: string | null; name: string };
};

/**
 * Append one money movement to the immutable ledger (PRD v1.1 §14.1). Call inside the same transaction as the change
 * to the order/booking/donation so the two can never disagree. `net = amount - fee`.
 */
export async function recordLedger(e: LedgerEntry, session?: ClientSession) {
  const fee = e.fee ?? 0;
  await Payment.create([{
    kind: e.kind, refId: e.refId, refNumber: e.refNumber, type: e.type, provider: e.provider, method: e.method, providerRef: e.providerRef ?? null,
    amount: e.amount, currency: e.currency, fee, tax: e.tax ?? 0, net: e.amount - fee, note: e.note ?? "", actor: e.actor,
  }], { session });
}

export type LedgerRow = Pick<PaymentDoc, "type" | "provider" | "method" | "providerRef" | "amount" | "currency" | "fee" | "net" | "note"> & { id: string; at: string; by: string };

export async function ledgerFor(kind: LedgerKind, refId: string): Promise<LedgerRow[]> {
  await connectDB();
  const rows = await Payment.find({ kind, refId }).sort({ createdAt: 1, _id: 1 }).lean();
  return rows.map((r) => ({
    id: String(r._id), type: r.type, provider: r.provider, method: r.method, providerRef: r.providerRef, amount: r.amount, currency: r.currency,
    fee: r.fee, net: r.net, note: r.note, at: r.createdAt.toISOString(), by: r.actor.name,
  }));
}

/** Net money held per kind and currency (charges − refunds), for reconciliation. */
export async function ledgerTotals(kind: LedgerKind) {
  await connectDB();
  return Payment.aggregate<{ _id: string; charged: number; refunded: number; fees: number }>([
    { $match: { kind } },
    { $group: { _id: "$currency", charged: { $sum: { $cond: [{ $eq: ["$type", "charge"] }, "$amount", 0] } }, refunded: { $sum: { $cond: [{ $eq: ["$type", "refund"] }, "$amount", 0] } }, fees: { $sum: "$fee" } } },
  ]);
}
