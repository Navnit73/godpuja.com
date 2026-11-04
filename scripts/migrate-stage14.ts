/**
 * Stage 14 data migration. Idempotent; safe to run more than once.
 *
 *   npm run migrate:stage14            # dry run: counts what would change
 *   npm run migrate:stage14 -- --apply # writes
 *
 * 1. redirects: "/category/<path>" -> "/shop/<path>" in both `from` and `to` (categories moved to /shop in Stage 14).
 *    The app also redirects any remaining /category/... URL, so this only removes an extra hop.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import mongoose from "mongoose";
import { connectDB } from "../src/server/db";

const apply = process.argv.includes("--apply");
const LEGACY = /^\/category\//;
const rewrite = (f: string) => ({ $cond: [{ $regexMatch: { input: f, regex: "^/category/" } }, { $concat: ["/shop/", { $substrCP: [f, 10, { $strLenCP: f }] }] }, f] });

async function main() {
  await connectDB();
  const db = mongoose.connection.db!;
  const redirects = db.collection("redirects");
  console.log(`${apply ? "APPLYING" : "DRY RUN"} on database "${db.databaseName}"`);
  const filter = { $or: [{ from: LEGACY }, { to: LEGACY }] };
  const n = await redirects.countDocuments(filter);
  console.log(`redirects pointing at or from /category/...: ${n}`);
  if (apply && n) {
    const res = await redirects.updateMany(filter, [{ $set: { from: rewrite("$from"), to: rewrite("$to") } }]);
    console.log(`updated ${res.modifiedCount}`);
  }
  if (!apply) console.log("Nothing written. Re-run with --apply to migrate.");
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
