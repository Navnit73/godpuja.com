import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { User } from "@/server/models/User";

describe("database (godpuja_test)", () => {
  beforeAll(async () => {
    await connectDB();
    // Safety: abort before any destructive call unless we are on the test database.
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await User.syncIndexes();
    await User.deleteMany({});
  });
  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  it("connects to the test database, not production", () => {
    expect(mongoose.connection.name).toBe("godpuja_test");
  });
  it("lowercases email, defaults to customer, hides passwordHash by default", async () => {
    await User.create({ name: "T", email: "Test@Example.COM", passwordHash: "h" });
    const u = await User.findOne({ email: "test@example.com" }).lean();
    expect(u?.role).toBe("customer");
    expect((u as Record<string, unknown>).passwordHash).toBeUndefined();
    const withHash = await User.findOne({ email: "test@example.com" }).select("+passwordHash").lean();
    expect(withHash?.passwordHash).toBe("h");
  });
  it("enforces unique email", async () => {
    await expect(User.create({ name: "D", email: "test@example.com", passwordHash: "h" })).rejects.toMatchObject({ code: 11000 });
  });
  it("rejects invalid roles", async () => {
    await expect(User.create({ name: "R", email: "r@example.com", passwordHash: "h", role: "root" as never })).rejects.toThrow();
  });
});
