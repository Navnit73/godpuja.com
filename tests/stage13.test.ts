// Stage 13 — customer accounts, notifications, payment ledger (PRD v1.1 §11, §14.1, §15, §16).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";

// next/headers cookies() only exists inside a Next request; route handlers under test write to this jar instead.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    set: (n: string, v: string) => { jar.set(n, v); },
    delete: (n: string) => { jar.delete(n); },
  }),
}));

process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.PAYMENT_WEBHOOK_SECRET ??= "test-webhook-secret-0123456789";

import { connectDB } from "@/server/db";
import { ApiError } from "@/server/api";
import { AuthToken } from "@/server/models/AuthToken";
import { Category } from "@/server/models/Category";
import { Counter } from "@/server/models/Counter";
import { Notification } from "@/server/models/Notification";
import { Order } from "@/server/models/Order";
import { Payment } from "@/server/models/Payment";
import { Product } from "@/server/models/Product";
import { RateLimit } from "@/server/models/RateLimit";
import { User } from "@/server/models/User";
import { WebhookEvent } from "@/server/models/WebhookEvent";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { resolveUser, userFromRequest } from "@/server/auth/guard";
import { readFlowCookie, signInWithGoogle, startGoogleFlow, verifyGoogleIdToken } from "@/server/auth/google";
import { SESSION_COOKIE, signSession, verifySession } from "@/server/auth/session";
import { sendEmail } from "@/server/email/send";
import * as T from "@/server/email/templates";
import { consumeToken, issueToken } from "@/server/services/auth-tokens";
import {
  addAddress, changePassword, claimGuestOrders, getMyOrder, getProfile, listAddresses, listMyOrders, removeAddress, requestPasswordReset,
  resetPassword, sendVerification, updateAddress, updateProfile, verifyEmail,
} from "@/server/services/account";
import { ledgerFor, ledgerTotals } from "@/server/services/ledger";
import { flushNotifications } from "@/server/services/notifications";
import { createProduct } from "@/server/services/products";
import { changePayment, changeStatus, placeOrder, refundOrder } from "@/server/services/orders";
import { applyPaymentEvent } from "@/server/services/payments";
import { _resetRateLimit } from "@/server/rate-limit";
import { POST as registerPOST } from "@/app/api/auth/register/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { GET as googleCallback } from "@/app/api/auth/google/callback/route";
import { profileSchema, savedAddressSchema } from "@/lib/validation/account";
import { checkoutSchema, webhookEventSchema } from "@/lib/validation/orders";
import { emptySeo } from "@/lib/validation/pages";
import type { ProductInput } from "@/lib/validation/catalog";
import { NextRequest } from "next/server";

const ACTOR = { id: null, name: "Tester" };
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};
const json = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${url}`, { method: "POST", headers: { "content-type": "application/json", host: "localhost:3000", ...headers }, body: JSON.stringify(body) });

// ---------------------------------------------------------------- pure
describe("email templates and sending", () => {
  it("escapes customer text in HTML and keeps a plain-text part", () => {
    const m = T.verifyEmail("GodPuja", "a@x.com", "<script>alert(1)</script>", "https://godpuja.com/verify-email?token=abc");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.text).toContain("https://godpuja.com/verify-email?token=abc");
    expect(m.subject).toBe("Confirm your email address — GodPuja");
  });
  it("order emails show amounts in the order currency and the delivery address", () => {
    const m = T.orderPlaced("GodPuja", "a@x.com", {
      orderNumber: "GP-2611-000001", currency: "INR", status: "confirmed", items: [{ name: "Diya", qty: 2, lineTotal: 19950 }],
      pricing: { subtotal: 19950, shipping: 0, total: 19950 }, paymentMethod: "cod",
      shippingAddress: { name: "Asha", line1: "1 Road", city: "Pune", state: "MH", postalCode: "411001", country: "IN" },
    }, "https://x/order/1");
    expect(m.text).toContain("Total (INR): ₹199.50");
    expect(m.text).toContain("Pune, MH 411001");
    expect(T.orderPlaced("S", "a@x.com", { orderNumber: "N", currency: "INR", status: "pending_payment", items: [], pricing: { subtotal: 0, shipping: 0, total: 0 }, paymentMethod: "card", shippingAddress: { name: "A", line1: "1", city: "C", state: "", postalCode: "1", country: "IN" } }, "u").subject).toContain("waiting for payment");
  });
  it("sends through Resend when configured and reports failures without throwing", async () => {
    const msg = { to: "a@x.com", subject: "S", html: "<p>h</p>", text: "h" };
    expect(await sendEmail(msg, {})).toEqual({ state: "skipped", reason: "Email provider not configured" });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "em_1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 }))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const cfg = { RESEND_API_KEY: "re_test", EMAIL_FROM: "GodPuja <a@godpuja.com>" };
    expect(await sendEmail(msg, cfg)).toEqual({ state: "sent", provider: "resend", providerId: "em_1" });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ from: cfg.EMAIL_FROM, to: ["a@x.com"], subject: "S" });
    expect(await sendEmail(msg, cfg)).toEqual({ state: "failed", provider: "resend", error: "403 domain not verified" });
    expect(await sendEmail(msg, cfg)).toEqual({ state: "failed", provider: "resend", error: "network down" });
    vi.unstubAllGlobals();
  });
});

describe("account validation", () => {
  it("validates profile preferences", () => {
    expect(profileSchema.safeParse({ prefs: { country: "us", language: "en", currency: "usd", timezone: "America/New_York" } }).success).toBe(true);
    for (const prefs of [
      { country: "XX", language: "en", currency: "INR", timezone: "Asia/Kolkata" },
      { country: "IN", language: "fr", currency: "INR", timezone: "Asia/Kolkata" },
      { country: "IN", language: "en", currency: "RUPEE", timezone: "Asia/Kolkata" },
      { country: "IN", language: "en", currency: "INR", timezone: "Asia/Bangalore" },
    ]) expect(profileSchema.safeParse({ prefs }).success, JSON.stringify(prefs)).toBe(false);
    expect(profileSchema.safeParse({}).success).toBe(false);
  });
  it("saved addresses use the same country rules as checkout", () => {
    const a = { name: "Ravi", line1: "1 Main St", city: "Edison", state: "NJ", postalCode: "08817", country: "US" };
    expect(savedAddressSchema.safeParse(a).success).toBe(true);
    expect(savedAddressSchema.safeParse({ ...a, postalCode: "411001" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------- Google (no network: local keys)
describe("Google sign-in tokens", () => {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  let sign: (claims: Record<string, unknown>) => Promise<string>;
  let keys: ReturnType<typeof createLocalJWKSet>;
  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] });
    // Standard claims are set first, then overridden by `c`, so tests can inject a bad iss/exp.
    sign = (c) => new SignJWT({
      iss: "https://accounts.google.com", aud: clientId, sub: "google-sub-1", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300,
      email: "devotee@gmail.com", email_verified: true, nonce: "n1", name: "Devotee", ...c,
    }).setProtectedHeader({ alg: "RS256", kid: "k1" }).sign(privateKey);
  });
  it("accepts a valid token and normalises the email", async () => {
    expect(await verifyGoogleIdToken(await sign({ email: "Devotee@Gmail.com" }), "n1", keys, clientId)).toEqual({ sub: "google-sub-1", email: "devotee@gmail.com", name: "Devotee" });
  });
  it("rejects a wrong nonce, audience, issuer, expiry or an unverified email", async () => {
    await expect(verifyGoogleIdToken(await sign({}), "other-nonce", keys, clientId)).rejects.toThrow();
    await expect(verifyGoogleIdToken(await sign({}), "n1", keys, "someone-else")).rejects.toThrow();
    await expect(verifyGoogleIdToken(await sign({ email_verified: false }), "n1", keys, clientId)).rejects.toThrow(/not verified/);
    await expect(verifyGoogleIdToken(await sign({ iss: "https://evil.example" }), "n1", keys, clientId)).rejects.toThrow();
    await expect(verifyGoogleIdToken(await sign({ exp: Math.floor(Date.now() / 1000) - 60 }), "n1", keys, clientId)).rejects.toThrow();
  });
  it("starts the flow with PKCE, state and nonce in a signed cookie", async () => {
    const { url, cookie } = await startGoogleFlow("/checkout");
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/google\/callback$/);
    const flow = await readFlowCookie(cookie);
    expect(flow).toMatchObject({ state: u.searchParams.get("state"), nonce: u.searchParams.get("nonce"), next: "/checkout" });
    expect(flow!.verifier.length).toBeGreaterThanOrEqual(43);
    expect(await readFlowCookie(cookie.slice(0, -2) + "xx")).toBeNull(); // tampered
  });
  it("the callback refuses a state mismatch without calling Google", async () => {
    const { cookie } = await startGoogleFlow("/account");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await googleCallback(new NextRequest("http://localhost:3000/api/auth/google/callback?state=forged&code=abc", { headers: { cookie: `gp_oauth=${cookie}` } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=google_failed");
    expect(fetchSpy).not.toHaveBeenCalled();
    const cancelled = await googleCallback(new NextRequest("http://localhost:3000/api/auth/google/callback?error=access_denied", { headers: { cookie: `gp_oauth=${cookie}` } }));
    expect(cancelled.headers.get("location")).toContain("error=google_cancelled");
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------- database
const prod = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Brass diya", slug: "brass-diya", sku: "DIYA-1", shortDescription: "", description: "", images: [{ url: "https://example.com/a.jpg", alt: "Diya" }], category: null, brand: "",
  price: 10000, salePrice: null, stock: 50, lowStockThreshold: 5, status: "active", isFeatured: false, attributes: [], variants: [],
  shipping: { weightGrams: 0, length: 0, width: 0, height: 0, freeShipping: false }, seo: { ...emptySeo }, ...over,
});
const IN = { name: "Asha Rao", line1: "12 MG Road", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "IN" };
let keyN = 0;
const key = () => `s13-key-${Date.now()}-${++keyN}`;
const checkoutBody = (productId: string, over: Record<string, unknown> = {}) => ({
  items: [{ productId, qty: 1 }], email: "asha@example.com", phone: "+91 98765 43210", shippingAddress: IN, billingSameAsShipping: true, paymentMethod: "cod", ...over,
});

describe("Stage 13 with the database (godpuja_test)", () => {
  const wipe = () => Promise.all([User, Order, Product, Category, Counter, AuthToken, Notification, Payment, WebhookEvent, RateLimit].map((m) => (m as typeof User).deleteMany({})));
  beforeAll(async () => {
    await connectDB();
    if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to run on ${mongoose.connection.name}`);
    await Promise.all([User, Order, Product, AuthToken, Notification, Payment, WebhookEvent].map((m) => (m as typeof User).syncIndexes()));
  });
  beforeEach(async () => { await flushNotifications(); await wipe(); jar.clear(); _resetRateLimit(); });
  afterAll(async () => { await flushNotifications(); await wipe(); await mongoose.disconnect(); });

  let n = 0;
  const mkProduct = () => { n++; return createProduct(prod({ name: `S13 ${n}`, slug: `s13-${n}`, sku: `S13-${n}` })); };
  const mkUser = async (email: string, over: Record<string, unknown> = {}) =>
    String((await User.create({ name: "Asha Rao", email, passwordHash: await hashPassword("longenough1"), role: "customer", ...over }))._id);
  const notifications = async (template?: string) => { await flushNotifications(); return Notification.find(template ? { template } : {}).lean(); };

  describe("single-use tokens", () => {
    it("work once, only for their kind, and expire", async () => {
      const uid = await mkUser("t@x.com");
      const raw = await issueToken(uid, "t@x.com", "verify_email");
      expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect((await AuthToken.findOne().lean())!.tokenHash).not.toContain(raw); // only the hash is stored
      expect(await consumeToken(raw, "password_reset")).toBeNull();
      expect(await consumeToken(raw, "verify_email")).toEqual({ userId: uid, email: "t@x.com" });
      expect(await consumeToken(raw, "verify_email")).toBeNull(); // used
      const old = await issueToken(uid, "t@x.com", "password_reset");
      await AuthToken.updateOne({ kind: "password_reset" }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await consumeToken(old, "password_reset")).toBeNull(); // expired
      expect(await consumeToken("short", "verify_email")).toBeNull();
    });
    it("two parallel uses of one token: exactly one wins", async () => {
      const uid = await mkUser("p@x.com");
      const raw = await issueToken(uid, "p@x.com", "password_reset");
      const results = await Promise.all(Array.from({ length: 5 }, () => consumeToken(raw, "password_reset")));
      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });

  describe("registration and email verification", () => {
    it("registers a customer (role cannot be chosen), signs in, and sends a verification email", async () => {
      const res = await registerPOST(json("/api/auth/register", { name: "Asha", email: " Asha@Example.com ", password: "longenough1", role: "superadmin" }));
      expect(res.status).toBe(201);
      const u = (await User.findOne({ email: "asha@example.com" }).lean())!;
      expect(u.role).toBe("customer");
      expect(u.emailVerifiedAt).toBeNull();
      expect(await verifySession(jar.get(SESSION_COOKIE))).toMatchObject({ uid: String(u._id), role: "customer" });
      const sent = await notifications("account.verify_email");
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ to: "asha@example.com", state: "skipped", ref: { kind: "user", id: String(u._id) } });
      expect((await registerPOST(json("/api/auth/register", { name: "Asha", email: "asha@example.com", password: "longenough1" }))).status).toBe(409);
    });
    it("verifying the email claims earlier guest orders with that email, and nobody else's", async () => {
      const p = await mkProduct();
      const mine = await placeOrder(checkoutSchema.parse(checkoutBody(p.id)), key());
      const other = await placeOrder(checkoutSchema.parse(checkoutBody(p.id, { email: "someone@else.com" })), key());
      const uid = await mkUser("asha@example.com");
      expect((await listMyOrders(uid)).total).toBe(0); // unverified: not claimed yet
      const raw = await issueToken(uid, "asha@example.com", "verify_email");
      expect(await verifyEmail(raw)).toEqual({ userId: uid, claimed: 1 });
      expect((await getProfile(uid)).emailVerified).toBe(true);
      expect((await listMyOrders(uid)).items.map((o) => o.id)).toEqual([mine.orderId]);
      await fails(getMyOrder(uid, other.orderId), "NOT_FOUND"); // someone else's order: indistinguishable from missing
      await fails(verifyEmail(raw), "VALIDATION_ERROR"); // single use
      expect(await sendVerification(uid)).toBe("already_verified");
    });
    it("a link sent to an old email address stops working after the email changes", async () => {
      const uid = await mkUser("old@x.com");
      const raw = await issueToken(uid, "old@x.com", "verify_email");
      await User.updateOne({ _id: uid }, { $set: { email: "new@x.com" } });
      await fails(verifyEmail(raw), "VALIDATION_ERROR");
      expect((await getProfile(uid)).emailVerified).toBe(false);
    });
    it("a new verification link replaces the previous one", async () => {
      const uid = await mkUser("r@x.com");
      await sendVerification(uid);
      await sendVerification(uid);
      expect(await AuthToken.countDocuments({ user: uid, kind: "verify_email", usedAt: null })).toBe(1);
    });
  });

  describe("password reset and change", () => {
    it("does not reveal whether an account exists", async () => {
      await requestPasswordReset("nobody@x.com");
      expect(await notifications()).toHaveLength(0);
      await mkUser("real@x.com");
      await requestPasswordReset("real@x.com");
      expect(await notifications("account.password_reset")).toHaveLength(1);
      await mkUser("off@x.com", { isActive: false });
      await requestPasswordReset("off@x.com");
      expect(await notifications("account.password_reset")).toHaveLength(1); // disabled accounts get nothing
    });
    it("resets the password, signs out every session, verifies the email and kills other reset links", async () => {
      const uid = await mkUser("reset@x.com");
      const oldSession = { uid, role: "customer" as const, tv: 0 };
      expect(await resolveUser(oldSession)).not.toBeNull();
      const a = await issueToken(uid, "reset@x.com", "password_reset");
      const b = await issueToken(uid, "reset@x.com", "password_reset");
      const claims = await resetPassword(a, "brandnewpass9");
      expect(claims).toEqual({ uid, role: "customer", tv: 1 });
      expect(await resolveUser(oldSession)).toBeNull();
      const u = (await User.findById(uid).select("+passwordHash").lean())!;
      expect(await verifyPassword("brandnewpass9", u.passwordHash!)).toBe(true);
      expect(u.passwordHash!.startsWith("$2")).toBe(true); // stored as a hash, not misread as a field path
      expect(u.emailVerifiedAt).toBeInstanceOf(Date);
      await fails(resetPassword(b, "anotherpass99"), "VALIDATION_ERROR");
    });
    it("changing a password needs the current one; Google-only accounts can set one", async () => {
      const uid = await mkUser("c@x.com");
      await fails(changePassword(uid, "wrong", "brandnewpass9"), "VALIDATION_ERROR");
      expect((await changePassword(uid, "longenough1", "brandnewpass9")).tv).toBe(1);
      const g = String((await User.create({ name: "G", email: "g@x.com", googleSub: "g-1", emailVerifiedAt: new Date(), role: "customer" }))._id);
      expect((await getProfile(g)).hasPassword).toBe(false);
      await changePassword(g, undefined, "brandnewpass9");
      expect((await getProfile(g)).hasPassword).toBe(true);
    });
  });

  describe("profile and saved addresses", () => {
    it("updates name, phone and preferences", async () => {
      const uid = await mkUser("pr@x.com");
      const p = await updateProfile(uid, profileSchema.parse({ name: "Asha R", phone: "+1 732 555 0100", prefs: { country: "US", language: "en", currency: "USD", timezone: "America/New_York" } }));
      expect(p).toMatchObject({ name: "Asha R", phone: "+1 732 555 0100", prefs: { country: "US", currency: "USD", timezone: "America/New_York" } });
    });
    it("keeps exactly one default, caps the list, and stores text literally", async () => {
      const uid = await mkUser("ad@x.com");
      const a = savedAddressSchema.parse({ ...IN, label: "Home" });
      let list = await addAddress(uid, a);
      expect(list).toHaveLength(1);
      expect(list[0].isDefault).toBe(true); // first address becomes the default
      list = await addAddress(uid, savedAddressSchema.parse({ ...IN, line1: "$where: 1 Temple Rd", label: "Parents", isDefault: true }));
      expect(list.filter((x) => x.isDefault).map((x) => x.label)).toEqual(["Parents"]);
      expect(list.find((x) => x.label === "Parents")!.line1).toBe("$where: 1 Temple Rd");
      const home = list.find((x) => x.label === "Home")!;
      list = await updateAddress(uid, home.id, savedAddressSchema.parse({ ...IN, label: "Home", city: "Mumbai", isDefault: true }));
      expect(list[0]).toMatchObject({ label: "Home", city: "Mumbai", isDefault: true });
      expect(list.filter((x) => x.isDefault)).toHaveLength(1);
      list = await removeAddress(uid, home.id);
      expect(list).toHaveLength(1);
      expect(list[0].isDefault).toBe(true); // the default moved to the remaining address
      for (let i = 0; i < 9; i++) await addAddress(uid, savedAddressSchema.parse({ ...IN, line1: `${i} Lane` }));
      await fails(addAddress(uid, a), "CONFLICT");
      expect(await listAddresses(uid)).toHaveLength(10);
      const other = await mkUser("other@x.com");
      await fails(removeAddress(other, list[0].id), "NOT_FOUND"); // cannot touch someone else's address
      await fails(updateAddress(other, list[0].id, a), "NOT_FOUND");
    });
  });

  describe("signed-in checkout", () => {
    it("links the order to the account, saves the address once, and keeps guests guests", async () => {
      const p = await mkProduct();
      const uid = await mkUser("asha@example.com", { emailVerifiedAt: new Date() });
      const cookie = `${SESSION_COOKIE}=${await signSession({ uid, role: "customer", tv: 0 })}`;
      const post = (body: unknown, h: Record<string, string> = {}) => checkoutPOST(json("/api/checkout", body, { "idempotency-key": key(), ...h }));
      const r1 = await post(checkoutBody(p.id, { saveAddress: true }), { cookie });
      expect(r1.status).toBe(201);
      const o1 = (await r1.json()).data;
      expect(String((await Order.findById(o1.orderId).lean())!.user)).toBe(uid);
      expect(await listAddresses(uid)).toHaveLength(1);
      await post(checkoutBody(p.id, { saveAddress: true }), { cookie });
      expect(await listAddresses(uid)).toHaveLength(1); // same address is not saved twice
      const guest = (await (await post(checkoutBody(p.id))).json()).data;
      expect((await Order.findById(guest.orderId).lean())!.user).toBeNull();
      expect((await listMyOrders(uid)).total).toBe(2);
      const forged = `${SESSION_COOKIE}=${await signSession({ uid, role: "customer", tv: 7 })}`; // revoked session version
      expect(await userFromRequest(json("/x", {}, { cookie: forged }))).toBeNull();
    });
  });

  describe("Google accounts", () => {
    const g = { sub: "google-1", email: "devotee@gmail.com", name: "Devotee" };
    it("creates a verified customer, then signs the same person in again", async () => {
      const first = await signInWithGoogle(g);
      expect(first).toMatchObject({ role: "customer", created: true });
      expect((await getProfile(first.uid)).emailVerified).toBe(true);
      const again = await signInWithGoogle(g);
      expect(again).toMatchObject({ uid: first.uid, created: false });
    });
    it("links to an existing customer with the same email and verifies it", async () => {
      const uid = await mkUser("devotee@gmail.com");
      expect((await signInWithGoogle(g)).uid).toBe(uid);
      expect((await User.findById(uid).lean())!.googleSub).toBe("google-1");
      await fails(signInWithGoogle({ ...g, sub: "google-2" }), "CONFLICT"); // a different Google account for the same email
    });
    it("never lets Google into a staff account", async () => {
      await mkUser("devotee@gmail.com", { role: "store_manager" });
      await fails(signInWithGoogle(g), "FORBIDDEN");
      const c = await signInWithGoogle({ ...g, email: "c@gmail.com", sub: "google-9" });
      await User.updateOne({ _id: c.uid }, { $set: { role: "admin" } }); // promoted later
      await fails(signInWithGoogle({ ...g, email: "c@gmail.com", sub: "google-9" }), "FORBIDDEN");
      await User.updateOne({ _id: c.uid }, { $set: { role: "customer", isActive: false } });
      await fails(signInWithGoogle({ ...g, email: "c@gmail.com", sub: "google-9" }), "FORBIDDEN");
    });
  });

  describe("payment ledger", () => {
    it("records charges and refunds immutably, in the order's currency", async () => {
      const p = await mkProduct();
      const o = await placeOrder(checkoutSchema.parse(checkoutBody(p.id)), key());
      expect(await ledgerFor("order", o.orderId)).toEqual([]); // COD: nothing collected yet
      await changePayment(o.orderId, "paid", ACTOR);
      await refundOrder(o.orderId, 5000, "Damaged lid", ACTOR);
      const rows = await ledgerFor("order", o.orderId);
      expect(rows.map((r) => [r.type, r.amount, r.currency, r.method])).toEqual([["charge", 15000, "INR", "cod"], ["refund", 5000, "INR", "cod"]]);
      expect(rows[1]).toMatchObject({ note: "Damaged lid", by: "Tester", net: 5000 });
      await expect(Payment.updateOne({}, { $set: { amount: 1 } })).rejects.toThrow(/immutable/);
      expect(await ledgerTotals("order")).toEqual([{ _id: "INR", charged: 15000, refunded: 5000, fees: 0 }]);
    });
    it("a failed refund leaves no ledger row (same transaction)", async () => {
      const p = await mkProduct();
      const o = await placeOrder(checkoutSchema.parse(checkoutBody(p.id)), key());
      await changePayment(o.orderId, "paid", ACTOR);
      await fails(refundOrder(o.orderId, 999_999, "Too much", ACTOR), "VALIDATION_ERROR");
      expect((await ledgerFor("order", o.orderId)).map((r) => r.type)).toEqual(["charge"]);
    });
    it("a webhook charge is recorded once with the provider reference, even when delivered twice", async () => {
      const p = await mkProduct();
      const o = await placeOrder(checkoutSchema.parse(checkoutBody(p.id)), key());
      const ev = webhookEventSchema.parse({ eventId: "evt-l1", type: "payment.succeeded", timestamp: Date.now(), orderNumber: o.orderNumber, providerPaymentId: "pay_77" });
      await applyPaymentEvent(ev);
      expect((await applyPaymentEvent(ev)).duplicate).toBe(true);
      const rows = await ledgerFor("order", o.orderId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: "charge", providerRef: "pay_77", by: "Payment webhook" });
      await applyPaymentEvent(webhookEventSchema.parse({ eventId: "evt-l2", type: "payment.refunded", timestamp: Date.now(), orderNumber: o.orderNumber, amount: 2000 }));
      expect((await ledgerFor("order", o.orderId)).map((r) => [r.type, r.amount])).toEqual([["charge", 15000], ["refund", 2000]]);
      expect(await notifications("order.refund")).toHaveLength(1);
    });
  });

  describe("order notifications", () => {
    it("emails the customer on placement and customer-relevant status changes only", async () => {
      const p = await mkProduct();
      const o = await placeOrder(checkoutSchema.parse(checkoutBody(p.id)), key());
      await changeStatus(o.orderId, "processing", "internal: packed by Ravi", ACTOR);
      await changeStatus(o.orderId, "shipped", undefined, ACTOR);
      const rows = await notifications();
      expect(rows.map((r) => r.template).sort()).toEqual(["order.placed", "order.status.shipped"]);
      expect(rows.every((r) => r.to === "asha@example.com" && r.ref?.id === o.orderId)).toBe(true);
      // The delivery log keeps no message body (no personal data or links stored).
      expect(Object.keys(rows[0])).not.toContain("html");
    });
    it("a replayed checkout does not email twice", async () => {
      const p = await mkProduct();
      const k = key();
      await placeOrder(checkoutSchema.parse(checkoutBody(p.id)), k);
      await placeOrder(checkoutSchema.parse(checkoutBody(p.id)), k);
      expect(await notifications("order.placed")).toHaveLength(1);
    });
  });

  it("claimGuestOrders is idempotent", async () => {
    const p = await mkProduct();
    await placeOrder(checkoutSchema.parse(checkoutBody(p.id)), key());
    const uid = await mkUser("asha@example.com");
    expect(await claimGuestOrders(uid, "Asha@Example.com")).toBe(1);
    expect(await claimGuestOrders(uid, "asha@example.com")).toBe(0);
  });
});
