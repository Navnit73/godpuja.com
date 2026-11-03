/**
 * Stage 12 data migration (PRD v1.1 global-ready foundations). Idempotent; safe to run more than once.
 *
 *   npm run migrate:stage12            # dry run: counts what would change
 *   npm run migrate:stage12 -- --apply # writes
 *
 * 1. users.role: "editor" -> "content_manager", "manager" -> "store_manager"
 * 2. users.addresses[].pincode -> postalCode
 * 3. orders: add currency "INR" where missing (every pre-Stage-12 order was charged in INR)
 * 4. orders.shippingAddress / billingAddress: pincode -> postalCode
 *
 * The app already reads old rows correctly (normalizeRole / normalizeAddress), so this can run at any time after deploy.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import mongoose from "mongoose";
import { connectDB } from "../src/server/db";
import { LEGACY_ROLES } from "../src/lib/roles";

const apply = process.argv.includes("--apply");

async function main() {
  await connectDB();
  const db = mongoose.connection.db!;
  const users = db.collection("users");
  const orders = db.collection("orders");
  console.log(`${apply ? "APPLYING" : "DRY RUN"} on database "${db.databaseName}"`);

  for (const [from, to] of Object.entries(LEGACY_ROLES)) {
    const n = await users.countDocuments({ role: from });
    console.log(`users: role ${from} -> ${to}: ${n}`);
    if (apply && n) await users.updateMany({ role: from }, { $set: { role: to } });
  }

  const addrFilter = { "addresses.pincode": { $exists: true } };
  const addrUsers = await users.countDocuments(addrFilter);
  console.log(`users: saved addresses with pincode: ${addrUsers}`);
  if (apply && addrUsers) {
    await users.updateMany(addrFilter, [{
      $set: {
        addresses: {
          $map: {
            input: "$addresses", as: "a",
            in: { $mergeObjects: [{ $unsetField: { field: "pincode", input: "$$a" } }, { postalCode: { $ifNull: ["$$a.postalCode", "$$a.pincode"] } }] },
          },
        },
      },
    }]);
  }

  const noCurrency = await orders.countDocuments({ currency: { $exists: false } });
  console.log(`orders: missing currency (-> INR): ${noCurrency}`);
  if (apply && noCurrency) await orders.updateMany({ currency: { $exists: false } }, { $set: { currency: "INR" } });

  for (const field of ["shippingAddress", "billingAddress"]) {
    const filter = { [`${field}.pincode`]: { $exists: true } };
    const n = await orders.countDocuments(filter);
    console.log(`orders: ${field}.pincode -> postalCode: ${n}`);
    if (apply && n) await orders.updateMany(filter, { $rename: { [`${field}.pincode`]: `${field}.postalCode` } });
  }

  if (!apply) console.log("Nothing written. Re-run with --apply to migrate.");
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
