import mongoose, { type ClientSession } from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { normalisePath, type RedirectInput } from "@/lib/validation/seo";
import { Redirect } from "../models/Redirect";

/**
 * Record that public URLs moved. Keeps the table loop-free and chain-free:
 * the new URL stops being a redirect source, and earlier redirects that pointed at the old URL are re-pointed.
 */
export async function recordRedirects(moves: { from: string; to: string }[], session?: ClientSession) {
  const real = moves.filter((m) => m.from !== m.to);
  if (!real.length) return;
  await Redirect.deleteMany({ from: { $in: real.map((m) => m.to) } }, { session });
  for (const m of real) {
    await Redirect.updateMany({ to: m.from }, { $set: { to: m.to } }, { session });
    await Redirect.updateOne({ from: m.from }, { $set: { to: m.to, code: 301 } }, { upsert: true, session });
  }
}

/** A URL that is (again) a real page must not keep an old redirect pointing away from it. */
export async function clearRedirectsFrom(urls: string[], session?: ClientSession) {
  if (urls.length) await Redirect.deleteMany({ from: { $in: urls } }, { session });
}
/** When a page is deleted, redirects that led to it would dangle. */
export async function dropRedirectsTo(urls: string[], session?: ClientSession) {
  if (urls.length) await Redirect.deleteMany({ to: { $in: urls } }, { session });
}

// ---------- Admin: manual redirects ----------

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export type RedirectItem = { id: string; from: string; to: string; code: number; hits: number; updatedAt: string };

export async function listRedirects({ q, page, limit }: { q?: string; page: number; limit: number }) {
  await connectDB();
  const filter = q ? { $or: [{ from: { $regex: escapeRegex(q.toLowerCase()) } }, { to: { $regex: escapeRegex(q), $options: "i" } }] } : {};
  const [rows, total] = await Promise.all([
    Redirect.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Redirect.countDocuments(filter),
  ]);
  const items: RedirectItem[] = rows.map((r) => ({ id: String(r._id), from: r.from, to: r.to, code: r.code ?? 301, hits: r.hits ?? 0, updatedAt: (r as unknown as { updatedAt: Date }).updatedAt.toISOString() }));
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Add a manual 301. Keeps the table chain- and loop-free: if `to` is itself redirected, point straight at its final
 * target; a target that would lead back to `from` is refused. Existing redirects into `from` are re-pointed.
 */
export async function createRedirect({ from, to }: RedirectInput) {
  await connectDB();
  const external = /^https:\/\//.test(to);
  let target = external ? to : normalisePath(to);
  if (!external) {
    const seen = new Set([from]);
    for (let hop = 0; hop < 10; hop++) {
      const next = await Redirect.findOne({ from: target }).select("to").lean();
      if (!next) break;
      if (seen.has(next.to) || next.to === from) throw new ApiError("VALIDATION_ERROR", "This would create a redirect loop", { to: "Leads back to the old path" });
      seen.add(target);
      target = next.to;
    }
    if (target === from) throw new ApiError("VALIDATION_ERROR", "This would create a redirect loop", { to: "Leads back to the old path" });
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Redirect.updateMany({ to: from }, { $set: { to: target } }, { session });
      await Redirect.updateOne({ from }, { $set: { to: target, code: 301 } }, { upsert: true, session });
    });
  } finally {
    await session.endSession();
  }
  return { from, to: target };
}

export async function deleteRedirect(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Redirect not found");
  await connectDB();
  const r = await Redirect.findByIdAndDelete(id).lean();
  if (!r) throw new ApiError("NOT_FOUND", "Redirect not found");
}

/** Whole table for the proxy's in-memory lookup (bounded). */
export async function loadRedirectMap(limit = 50_000) {
  await connectDB();
  const rows = await Redirect.find().select("from to").limit(limit).lean();
  return new Map(rows.map((r) => [r.from, r.to]));
}
