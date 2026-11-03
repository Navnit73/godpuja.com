import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { normalizeRole } from "@/lib/roles";
import { User } from "../models/User";
import { can, type Permission } from "./permissions";
import { getSession, type Session } from "./session";

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

/** Current user from cookie session + DB (never trusts the JWT role). Null if signed out/revoked. */
export const currentUser = async () => resolveUser(await getSession());

/** Authoritative check for route handlers: valid session, active user, permission held. */
export async function requireUser(permission?: Permission) {
  const user = await currentUser();
  if (!user) throw new ApiError("UNAUTHENTICATED", "Please sign in");
  if (permission && !can(user.role, permission)) throw new ApiError("FORBIDDEN", "Not allowed");
  return user;
}
