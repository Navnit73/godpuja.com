import mongoose from "mongoose";
import { redirect } from "next/navigation";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { normalizeRole } from "@/lib/roles";
import { User } from "../models/User";
import { can, type Permission } from "./permissions";
import { getSession, SESSION_COOKIE, verifySession, type Session } from "./session";

/** Resolve a session to a live user: must exist, be active, and match the session's tokenVersion. */
export async function resolveUser(session: Session | null) {
  if (!session || !mongoose.isValidObjectId(session.uid)) return null;
  await connectDB();
  const user = await User.findById(session.uid).select("name email role isActive tokenVersion templeIds").lean();
  if (!user || !user.isActive || (user.tokenVersion ?? 0) !== session.tv) return null;
  const role = normalizeRole(user.role); // tolerate rows not yet migrated by scripts/migrate-stage12.ts
  if (!role) return null;
  return { ...user, role, templeIds: (user.templeIds ?? []).map(String) };
}

/** Signed-in user from a Request's own Cookie header (route handlers that also run outside Next's request scope). */
export async function userFromRequest(req: Request) {
  const raw = req.headers.get("cookie") ?? "";
  const token = raw.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return resolveUser(await verifySession(token ? decodeURIComponent(token) : undefined));
}

/** Current user from cookie session + DB (never trusts the JWT role). Null if signed out/revoked. */
export const currentUser = async () => resolveUser(await getSession());

/** Authoritative check for route handlers: valid session, active user, permission held. */
export async function requireUser(permission?: Permission) {
  const user = await currentUser();
  if (!user) throw new ApiError("UNAUTHENTICATED", "Please sign in");
  if (permission && !can(user.role, permission)) throw new ApiError("FORBIDDEN", "Not allowed");
  return user;
}

/** Server pages under /account: the signed-in user, or a redirect to sign in (the proxy normally catches this first). */
export async function requireAccount(next: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
