import { describe, expect, it, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { can, isStaff } from "@/server/auth/permissions";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { signSession, verifySession } from "@/server/auth/session";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { _resetRateLimit, rateLimit } from "@/server/rate-limit";
import { ApiError } from "@/server/api";

describe("permissions", () => {
  it("customers have no admin permissions and are not staff", () => {
    expect(can("customer", "pages:read")).toBe(false);
    expect(isStaff("customer")).toBe(false);
  });
  it("editor can edit pages but not orders or users", () => {
    expect(can("editor", "pages:write")).toBe(true);
    expect(can("editor", "orders:read")).toBe(false);
    expect(can("editor", "users:write")).toBe(false);
  });
  it("manager handles orders but not pages", () => {
    expect(can("manager", "orders:write")).toBe(true);
    expect(can("manager", "pages:write")).toBe(false);
  });
  it("only superadmin manages users", () => {
    expect(can("superadmin", "users:write")).toBe(true);
    expect(can("admin", "users:write")).toBe(false);
  });
});

describe("password", () => {
  it("hashes and verifies; rejects wrong and unknown user", async () => {
    const h = await hashPassword("correct-horse-1");
    expect(h).not.toContain("correct-horse");
    expect(await verifyPassword("correct-horse-1", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("anything", undefined)).toBe(false);
  });
});

describe("session token", () => {
  it("round-trips uid and role", async () => {
    const t = await signSession({ uid: "abc", role: "admin", tv: 0 });
    expect(await verifySession(t)).toEqual({ uid: "abc", role: "admin", tv: 0 });
  });
  it("rejects missing, garbage, and tampered tokens", async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("garbage")).toBeNull();
    const t = await signSession({ uid: "abc", role: "customer", tv: 0 });
    const [h, , s] = t.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "abc", role: "superadmin" })).toString("base64url")}.${s}`;
    expect(await verifySession(forged)).toBeNull();
  });
  it("rejects tokens signed with another secret and expired tokens", async () => {
    const other = await new SignJWT({ role: "superadmin" }).setProtectedHeader({ alg: "HS256" })
      .setSubject("x").setExpirationTime("1h").sign(new TextEncoder().encode("y".repeat(40)));
    expect(await verifySession(other)).toBeNull();
    const expired = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" })
      .setSubject("x").setIssuedAt(1).setExpirationTime(2)
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
    expect(await verifySession(expired)).toBeNull();
  });
  it("rejects alg=none tokens", async () => {
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"x","role":"superadmin"}').toString("base64url")}.`;
    expect(await verifySession(none)).toBeNull();
  });
});

describe("validation", () => {
  it("normalises email and rejects bad login input", () => {
    expect(loginSchema.parse({ email: " A@B.com ", password: "x" }).email).toBe("a@b.com");
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
  it("enforces password strength and ignores a role field on register", () => {
    expect(registerSchema.safeParse({ name: "Ram", email: "r@x.com", password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ram", email: "r@x.com", password: "onlyletters" }).success).toBe(false);
    const parsed = registerSchema.parse({ name: "Ram", email: "r@x.com", password: "longenough1", role: "superadmin" });
    expect("role" in parsed).toBe(false);
  });
});

describe("rate limit", () => {
  beforeEach(() => _resetRateLimit());
  it("blocks after the limit with Retry-After", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 60_000);
    try {
      rateLimit("k", 3, 60_000);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("RATE_LIMITED");
      expect((e as ApiError).headers?.["Retry-After"]).toBeDefined();
    }
    rateLimit("other", 3, 60_000); // separate key unaffected
  });
});
