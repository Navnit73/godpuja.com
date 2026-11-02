import type { ClientSession } from "mongoose";
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
