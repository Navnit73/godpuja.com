import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey } from "jose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { env } from "../env";
import { User } from "../models/User";
import { isStaff } from "./permissions";
import { normalizeRole } from "@/lib/roles";

/**
 * "Continue with Google": OpenID Connect authorization-code flow with PKCE, `state` (CSRF) and `nonce` (replay),
 * implemented with `jose` only. The flow's secrets travel in a short-lived signed, httpOnly cookie.
 */
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const OAUTH_COOKIE = "gp_oauth";
export const OAUTH_MAX_AGE = 600; // 10 minutes to complete the Google screen

export const googleConfigured = () => !!(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
const redirectUri = () => `${env().SITE_URL}/api/auth/google/callback`;
const b64url = (b: Buffer) => b.toString("base64url");
const key = () => new TextEncoder().encode(env().AUTH_SECRET);

type FlowState = { state: string; nonce: string; verifier: string; next: string };

/** Build the Google authorization URL and the signed cookie value that remembers this attempt. */
export async function startGoogleFlow(next: string): Promise<{ url: string; cookie: string }> {
  if (!googleConfigured()) throw new ApiError("NOT_CONFIGURED", "Google sign-in is not configured");
  const flow: FlowState = { state: b64url(crypto.randomBytes(24)), nonce: b64url(crypto.randomBytes(24)), verifier: b64url(crypto.randomBytes(48)), next };
  const challenge = b64url(crypto.createHash("sha256").update(flow.verifier).digest());
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: "openid email profile",
    state: flow.state, nonce: flow.nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  const cookie = await new SignJWT(flow).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${OAUTH_MAX_AGE}s`).setAudience("gp-oauth").sign(key());
  return { url: url.toString(), cookie };
}

export async function readFlowCookie(value: string | undefined): Promise<FlowState | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, key(), { algorithms: ["HS256"], audience: "gp-oauth" });
    const p = payload as unknown as FlowState;
    return typeof p.state === "string" && typeof p.nonce === "string" && typeof p.verifier === "string" && typeof p.next === "string" ? p : null;
  } catch {
    return null;
  }
}

export const sameState = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

let jwks: JWTVerifyGetKey | null = null;
const googleKeys = () => (jwks ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")));

export type GoogleIdentity = { sub: string; email: string; name: string };

/** Verify a Google ID token: signature, issuer, audience, expiry, nonce, and a verified email. `keys` is injectable for tests. */
export async function verifyGoogleIdToken(idToken: string, nonce: string, keys: JWTVerifyGetKey = googleKeys(), clientId = env().GOOGLE_CLIENT_ID!): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, keys, { issuer: ISSUERS, audience: clientId, algorithms: ["RS256"] });
  if (payload.nonce !== nonce) throw new ApiError("UNAUTHENTICATED", "Google sign-in could not be verified");
  if (payload.email_verified !== true || typeof payload.email !== "string" || !payload.sub) {
    throw new ApiError("UNAUTHENTICATED", "Your Google account email is not verified");
  }
  const email = payload.email.trim().toLowerCase();
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 100) : email.split("@")[0];
  return { sub: payload.sub, email, name };
}

/** Exchange the authorization code (with the PKCE verifier) for an ID token and verify it. */
export async function exchangeCode(code: string, flow: FlowState): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env().GOOGLE_CLIENT_ID!, client_secret: env().GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(), grant_type: "authorization_code", code_verifier: flow.verifier }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as { id_token?: string } | null;
  if (!res.ok || !body?.id_token) throw new ApiError("UPSTREAM", "Google sign-in failed");
  return verifyGoogleIdToken(body.id_token, flow.nonce);
}

/**
 * Find or create the account for a verified Google identity.
 * - Known Google id: sign in.
 * - Existing customer with the same (Google-verified) email: link the Google id, mark the email verified.
 * - Existing STAFF account with that email: refused. Staff sign in with their password, so a Google account can
 *   never become a way into the admin.
 * - Otherwise: create a customer.
 */
export async function signInWithGoogle(g: GoogleIdentity): Promise<{ uid: string; role: "customer"; tv: number; email: string; created: boolean }> {
  await connectDB();
  type Row = { _id: unknown; role: string; isActive: boolean; tokenVersion?: number | null; email: string };
  let u: Row | null = await User.findOne({ googleSub: g.sub }).select("role isActive tokenVersion email").lean();
  let created = false;
  if (!u) {
    const byEmail = await User.findOne({ email: g.email }).select("role isActive tokenVersion email googleSub").lean();
    if (byEmail) {
      const role = normalizeRole(byEmail.role);
      if (!role || isStaff(role)) throw new ApiError("FORBIDDEN", "Staff accounts sign in with email and password.");
      if (byEmail.googleSub && byEmail.googleSub !== g.sub) throw new ApiError("CONFLICT", "This email is linked to a different Google account.");
      u = await User.findOneAndUpdate({ _id: byEmail._id }, [{ $set: { googleSub: { $literal: g.sub }, emailVerifiedAt: { $ifNull: ["$emailVerifiedAt", "$$NOW"] } } }], { returnDocument: "after", updatePipeline: true })
        .select("role isActive tokenVersion email").lean();
    } else {
      try {
        const doc = await User.create({ name: g.name, email: g.email, googleSub: g.sub, emailVerifiedAt: new Date(), role: "customer" });
        u = { _id: doc._id, role: "customer", isActive: true, tokenVersion: 0, email: doc.email };
        created = true;
      } catch (err) {
        if ((err as { code?: number }).code === 11000) return signInWithGoogle(g); // a parallel callback created it first
        throw err;
      }
    }
  }
  if (!u || !u.isActive) throw new ApiError("FORBIDDEN", "This account is disabled.");
  const role = normalizeRole(u.role);
  if (!role) throw new ApiError("FORBIDDEN", "This account cannot sign in.");
  // Also covers a customer who linked Google and was later promoted to staff.
  if (isStaff(role)) throw new ApiError("FORBIDDEN", "Staff accounts sign in with email and password.");
  return { uid: String(u._id), role: "customer", tv: u.tokenVersion ?? 0, email: u.email, created };
}
