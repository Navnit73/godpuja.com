import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { User } from "@/server/models/User";
import { resolveUser } from "@/server/auth/guard";
import { signSession, verifySession } from "@/server/auth/session";
import { createUser, getSessionClaims, listUsers, updateUser, userStats } from "@/server/services/users";
import { ApiError } from "@/server/api";
import { can } from "@/server/auth/permissions";
import { createUserSchema, listUsersSchema, updateUserSchema } from "@/lib/validation/users";

const pw = "longenough1";
const mk = (email: string, role: "superadmin" | "admin" | "content_manager" | "store_manager" | "customer" = "content_manager") =>
  createUser({ name: "Test " + email, email, password: pw, role });
const fails = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ApiError);
  await p.catch((e: ApiError) => expect(e.code).toBe(code));
};

describe("users service (godpuja_test)", () => {
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await User.syncIndexes();
  });
  beforeEach(async () => { await User.deleteMany({}); });
  afterAll(async () => { await User.deleteMany({}); await mongoose.disconnect(); });

  it("creates users, rejects duplicate email with field error", async () => {
    const u = await mk("a@x.com");
    expect(u).toMatchObject({ email: "a@x.com", role: "content_manager", isActive: true });
    expect((u as Record<string, unknown>).passwordHash).toBeUndefined();
    await fails(mk("a@x.com"), "CONFLICT");
  });

  it("lists with pagination, role filter and safe regex search", async () => {
    for (let i = 0; i < 5; i++) await mk(`u${i}@x.com`, i < 2 ? "admin" : "content_manager");
    await mk("dot.name@x.com");
    const page1 = await listUsers({ page: 1, limit: 4 });
    expect(page1).toMatchObject({ total: 6, pages: 2 });
    expect(page1.items).toHaveLength(4);
    expect((await listUsers({ page: 1, limit: 50, role: "admin" })).total).toBe(2);
    expect((await listUsers({ page: 1, limit: 50, q: "DOT.NAME" })).total).toBe(1);
    // regex metacharacters must be treated literally, not as patterns
    expect((await listUsers({ page: 1, limit: 50, q: ".*" })).total).toBe(0);
    expect((await listUsers({ page: 1, limit: 50, q: "(" })).total).toBe(0);
  });

  it("stats count by staff vs customers", async () => {
    await mk("s@x.com", "admin"); await mk("c1@x.com", "customer"); await mk("c2@x.com", "customer");
    expect(await userStats()).toEqual({ total: 3, staff: 1, customers: 2 });
  });

  it("role / active / password changes bump tokenVersion; name change does not", async () => {
    const admin = await mk("boss@x.com", "superadmin");
    const u = await mk("e@x.com");
    const tv = async () => (await User.findById(u.id).lean())!.tokenVersion;
    expect(await tv()).toBe(0);
    await updateUser(admin.id, u.id, { name: "New Name" });
    expect(await tv()).toBe(0);
    await updateUser(admin.id, u.id, { role: "store_manager" });
    expect(await tv()).toBe(1);
    await updateUser(admin.id, u.id, { isActive: false });
    expect(await tv()).toBe(2);
    await updateUser(admin.id, u.id, { password: "anotherpass1" });
    expect(await tv()).toBe(3);
    await updateUser(admin.id, u.id, { role: "store_manager" }); // no-op role: no bump
    expect(await tv()).toBe(3);
  });

  it("revokes existing sessions on demotion and deactivation (resolveUser)", async () => {
    const admin = await mk("boss@x.com", "superadmin");
    const u = await mk("m@x.com", "store_manager");
    const session = { uid: u.id, role: "store_manager" as const, tv: 0 };
    expect(await resolveUser(session)).not.toBeNull();
    await updateUser(admin.id, u.id, { role: "content_manager" });
    expect(await resolveUser(session)).toBeNull(); // stale tokenVersion
    const fresh = { uid: u.id, role: "content_manager" as const, tv: 1 };
    expect(await resolveUser(fresh)).not.toBeNull();
    await updateUser(admin.id, u.id, { isActive: false });
    expect(await resolveUser({ ...fresh, tv: 2 })).toBeNull(); // inactive
    expect(await resolveUser(null)).toBeNull();
    expect(await resolveUser({ uid: "not-an-id", role: "admin", tv: 0 })).toBeNull(); // malformed uid: null, no throw
  });

  it("resolveUser uses the DB role, not the token role", async () => {
    const u = await mk("e@x.com", "content_manager");
    const r = await resolveUser({ uid: u.id, role: "superadmin", tv: 0 });
    expect(r?.role).toBe("content_manager");
  });

  it("blocks self role change / self deactivation", async () => {
    const a = await mk("a@x.com", "superadmin");
    await mk("b@x.com", "superadmin");
    await fails(updateUser(a.id, a.id, { role: "admin" }), "CONFLICT");
    await fails(updateUser(a.id, a.id, { isActive: false }), "CONFLICT");
    await expect(updateUser(a.id, a.id, { name: "Renamed Me" })).resolves.toMatchObject({ name: "Renamed Me" });
  });

  it("protects the last active superadmin", async () => {
    const only = await mk("only@x.com", "superadmin");
    const other = await mk("admin@x.com", "admin");
    // Another actor tries to demote/deactivate the only superadmin
    await fails(updateUser(other.id, only.id, { role: "admin" }), "CONFLICT");
    await fails(updateUser(other.id, only.id, { isActive: false }), "CONFLICT");
    const second = await mk("second@x.com", "superadmin");
    await expect(updateUser(other.id, only.id, { role: "admin" })).resolves.toMatchObject({ role: "admin" });
    await fails(updateUser(other.id, second.id, { isActive: false }), "CONFLICT"); // now the last one
  });

  it("revokes a real signed token end-to-end (sign -> verify -> resolve)", async () => {
    const admin = await mk("boss@x.com", "superadmin");
    const u = await mk("m@x.com", "store_manager");
    const token = await signSession({ uid: u.id, role: "store_manager", tv: 0 });
    expect(await resolveUser(await verifySession(token))).not.toBeNull();
    await updateUser(admin.id, u.id, { password: "anotherpass1" });
    expect(await resolveUser(await verifySession(token))).toBeNull();
    const claims = await getSessionClaims(u.id);
    expect(claims.tv).toBe(1);
    expect(await resolveUser(await verifySession(await signSession(claims)))).not.toBeNull(); // re-issued cookie works
  });

  it("concurrent mutual demotions never leave zero active superadmins", async () => {
    for (let round = 0; round < 5; round++) {
      await User.deleteMany({});
      const a = await mk(`a${round}@x.com`, "superadmin");
      const b = await mk(`b${round}@x.com`, "superadmin");
      const results = await Promise.allSettled([
        updateUser(a.id, b.id, { role: "admin" }),
        updateUser(b.id, a.id, { role: "admin" }),
      ]);
      const active = await User.countDocuments({ role: "superadmin", isActive: true });
      expect(active, `round ${round}`).toBeGreaterThanOrEqual(1);
      expect(results.filter((r) => r.status === "fulfilled").length).toBeLessThanOrEqual(1);
    }
  });

  it("concurrent deactivate + demote of the last two superadmins keeps one", async () => {
    const a = await mk("a@x.com", "superadmin");
    const b = await mk("b@x.com", "superadmin");
    const c = await mk("c@x.com", "admin"); // third-party actor
    await Promise.allSettled([
      updateUser(c.id, a.id, { isActive: false }),
      updateUser(c.id, b.id, { role: "content_manager" }),
    ]);
    expect(await User.countDocuments({ role: "superadmin", isActive: true })).toBe(1);
  });

  it("returns NOT_FOUND for unknown or malformed ids", async () => {
    const a = await mk("a@x.com", "superadmin");
    await fails(updateUser(a.id, "nope", { name: "Zed Zed" }), "NOT_FOUND");
    await fails(updateUser(a.id, new mongoose.Types.ObjectId().toString(), { name: "Zed Zed" }), "NOT_FOUND");
  });
});

describe("user validation & permissions", () => {
  it("create requires strong password, valid role, valid email", () => {
    const ok = { name: "Ram", email: " R@X.com ", password: pw, role: "content_manager" };
    expect(createUserSchema.parse(ok).email).toBe("r@x.com");
    expect(createUserSchema.safeParse({ ...ok, role: "root" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, password: "short" }).success).toBe(false);
  });
  it("update rejects empty and unknown-only bodies; strips unknown keys", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.safeParse({ tokenVersion: 99 }).success).toBe(false);
    expect("email" in updateUserSchema.parse({ name: "Ram Kumar", email: "x@y.com" })).toBe(false);
  });
  it("list query is bounded and coerced", () => {
    expect(listUsersSchema.parse({}).limit).toBe(20);
    expect(listUsersSchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(listUsersSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(listUsersSchema.safeParse({ role: "root" }).success).toBe(false);
  });
  it("only superadmin writes users; admin can read", () => {
    expect(can("superadmin", "users:write")).toBe(true);
    expect(can("admin", "users:read")).toBe(true);
    expect(can("admin", "users:write")).toBe(false);
    expect(can("content_manager", "users:read")).toBe(false);
  });
});
