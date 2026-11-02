import { describe, expect, it, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";
import { ApiError, handle } from "@/server/api";
import { safeNext } from "@/lib/safe-next";
import { _resetRateLimit, clientIp, rateLimit } from "@/server/rate-limit";
import { verifySession } from "@/server/auth/session";
import { registerSchema } from "@/lib/validation/auth";

const post = (headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/x", { method: "POST", headers: { host: "localhost:3000", ...headers } });
const okHandler = handle(async () => new Response("ok"));

describe("handle()", () => {
  it("allows same-origin and missing Origin", async () => {
    expect((await okHandler(post({ origin: "http://localhost:3000" }))).status).toBe(200);
    expect((await okHandler(post())).status).toBe(200);
  });
  it("blocks cross-origin and Origin: null with 403 (not 500)", async () => {
    expect((await okHandler(post({ origin: "https://evil.com" }))).status).toBe(403);
    expect((await okHandler(post({ origin: "null" }))).status).toBe(403);
  });
  it("maps ApiError and hides unexpected error details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = await handle(async () => { throw new ApiError("NOT_FOUND", "nope"); })(post());
    expect(a.status).toBe(404);
    const b = await handle(async () => { throw new Error("db password leaked"); })(post());
    expect(b.status).toBe(500);
    expect(JSON.stringify(await b.json())).not.toContain("leaked");
    spy.mockRestore();
  });
});

describe("safeNext", () => {
  it.each(["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", "/a\nb"])(
    "rejects %j", (v) => expect(safeNext(v)).toBe("/admin"));
  it("accepts same-site paths", () => {
    expect(safeNext("/admin/orders?page=2")).toBe("/admin/orders?page=2");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});

describe("rate limit", () => {
  beforeEach(() => { _resetRateLimit(); vi.useRealTimers(); });
  it("resets after the window", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 2; i++) rateLimit("w", 2, 1000);
    expect(() => rateLimit("w", 2, 1000)).toThrow();
    vi.advanceTimersByTime(1001);
    expect(() => rateLimit("w", 2, 1000)).not.toThrow();
  });
  it("stays bounded under unique-key flooding", () => {
    for (let i = 0; i < 25_000; i++) rateLimit(`flood:${i}`, 5, 60_000);
    expect(() => rateLimit("flood:0", 5, 60_000)).not.toThrow();
  });
  it("ignores client-spoofed first X-Forwarded-For entry", () => {
    const r = (xff: string) => new Request("http://x", { headers: { "x-forwarded-for": xff } });
    expect(clientIp(r("1.1.1.1, 9.9.9.9"))).toBe("9.9.9.9");
    expect(clientIp(r("2.2.2.2, 9.9.9.9"))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("session role validation", () => {
  it("rejects a validly signed token carrying an unknown role", async () => {
    const t = await new SignJWT({ role: "root" }).setProtectedHeader({ alg: "HS256" })
      .setSubject("u").setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
    expect(await verifySession(t)).toBeNull();
  });
});

describe("password length", () => {
  it("rejects passwords over 72 bytes (bcrypt truncation)", () => {
    const base = { name: "Ram", email: "r@x.com" };
    expect(registerSchema.safeParse({ ...base, password: "a1" + "b".repeat(70) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "a1" + "b".repeat(71) }).success).toBe(false);
  });
});
