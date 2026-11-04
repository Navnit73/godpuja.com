import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/server/api";
import { exchangeCode, OAUTH_COOKIE, readFlowCookie, sameState, signInWithGoogle } from "@/server/auth/google";
import { setSessionCookie } from "@/server/auth/session";
import { claimGuestOrders } from "@/server/services/account";

const ERRORS: Record<string, string> = { FORBIDDEN: "google_staff", CONFLICT: "google_conflict" };

/** Google redirects here. Every failure lands back on /login with a short error code (never a stack or a 500 page). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, req.url), 303);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
    return res;
  };
  const flow = await readFlowCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (url.searchParams.get("error")) return fail("google_cancelled"); // user pressed Cancel on Google's screen
  if (!flow || !state || !code || !sameState(state, flow.state)) return fail("google_failed");
  try {
    const identity = await exchangeCode(code, flow);
    const s = await signInWithGoogle(identity);
    await claimGuestOrders(s.uid, s.email); // Google verified this email
    await setSessionCookie({ uid: s.uid, role: s.role, tv: s.tv });
    const res = NextResponse.redirect(new URL(flow.next, req.url), 303);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
    return res;
  } catch (err) {
    if (!(err instanceof ApiError)) console.error("[google] callback failed", err);
    return fail(err instanceof ApiError ? ERRORS[err.code] ?? "google_failed" : "google_failed");
  }
}
