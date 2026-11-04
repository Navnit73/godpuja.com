import { NextResponse } from "next/server";
import { googleConfigured, OAUTH_COOKIE, OAUTH_MAX_AGE, startGoogleFlow } from "@/server/auth/google";
import { clientIp, rateLimitShared } from "@/server/rate-limit";
import { safeNext } from "@/lib/safe-next";

/** Start "Continue with Google": remember state/nonce/PKCE verifier in a short-lived cookie and redirect to Google. */
export async function GET(req: Request) {
  const back = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, req.url), 303);
  if (!googleConfigured()) return back("google_unavailable");
  try {
    await rateLimitShared(`google:${clientIp(req)}`, 20, 15 * 60_000);
  } catch {
    return back("rate_limited");
  }
  const next = safeNext(new URL(req.url).searchParams.get("next"), "/account");
  const { url, cookie } = await startGoogleFlow(next);
  const res = NextResponse.redirect(url, 303);
  // SameSite=Lax: sent on Google's top-level redirect back to us, never on cross-site subrequests.
  res.cookies.set(OAUTH_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: OAUTH_MAX_AGE });
  return res;
}
