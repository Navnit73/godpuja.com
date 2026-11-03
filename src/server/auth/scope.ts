import mongoose from "mongoose";
import { isTempleScoped, type Role } from "@/lib/roles";
import { ApiError } from "../api";
import { can, type Permission } from "./permissions";

/**
 * Temple-level tenancy (PRD v1.1 §12, §15.1, §21.1 #13). Unscoped staff need only the permission; a scoped role
 * (temple operator) also needs the temple in `templeIds`. Used by the temple, slot and booking modules (Stages 18–20).
 */
export type ScopedUser = { role: Role; templeIds?: readonly unknown[] | null };

export function canAccessTemple(user: ScopedUser, templeId: string, permission: Permission): boolean {
  if (!can(user.role, permission)) return false;
  if (!isTempleScoped(user.role)) return true;
  return (user.templeIds ?? []).some((id) => String(id) === templeId);
}

/** Throws NOT_FOUND (not FORBIDDEN) so an operator cannot probe which other temples or bookings exist. */
export function assertTempleAccess(user: ScopedUser, templeId: string, permission: Permission): void {
  if (!can(user.role, permission)) throw new ApiError("FORBIDDEN", "Not allowed");
  if (!canAccessTemple(user, templeId, permission)) throw new ApiError("NOT_FOUND", "Not found");
}

/**
 * Mongo filter fragment restricting a query to the temples a user may see, for `field` (e.g. "_id" on temples,
 * "temple" on bookings). `{}` for unscoped staff; an impossible match when a scoped user has no temples.
 */
export function templeFilter(user: ScopedUser, field: string): Record<string, unknown> {
  if (!isTempleScoped(user.role)) return {};
  const ids = (user.templeIds ?? []).map(String).filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  return { [field]: { $in: ids } };
}
