import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import mongoose from "mongoose";
import { connectDB } from "../src/server/db";
import { User } from "../src/server/models/User";
import { hashPassword } from "../src/server/auth/password";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 10 chars)");
  }
  await connectDB();
  const existing = await User.findOne({ email });
  if (existing) {
    const ok = existing.role === "superadmin" && existing.isActive;
    console.log(ok ? `Superadmin already exists: ${email} (unchanged)`
      : `User ${email} exists but is role=${existing.role}, active=${existing.isActive}. Fix it manually; nothing changed.`);
    if (!ok) process.exitCode = 1;
  } else {
    await User.create({ name: "Super Admin", email, passwordHash: await hashPassword(password), role: "superadmin" });
    console.log(`Created superadmin: ${email}`);
  }
  await User.syncIndexes();
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
