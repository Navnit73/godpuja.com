import mongoose from "mongoose";
import { ApiError } from "../api";
import { hashPassword } from "../auth/password";
import { connectDB } from "../db";
import { User, type Role } from "../models/User";
import type { CreateUserInput, ListUsersInput, UpdateUserInput } from "@/lib/validation/users";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const FIELDS = "name email role isActive lastLoginAt createdAt";
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Lean = { _id: unknown; name: string; email: string; role: Role; isActive: boolean; lastLoginAt?: Date | null; createdAt: Date };
const toItem = (u: Lean): UserListItem => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  createdAt: u.createdAt.toISOString(),
});

export async function listUsers({ q, role, page, limit }: ListUsersInput) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [rows, total] = await Promise.all([
    User.find(filter).select(FIELDS).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { items: rows.map(toItem), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function userStats() {
  await connectDB();
  const rows = await User.aggregate<{ _id: Role; n: number }>([{ $group: { _id: "$role", n: { $sum: 1 } } }]);
  const byRole = Object.fromEntries(rows.map((r) => [r._id, r.n])) as Partial<Record<Role, number>>;
  const total = rows.reduce((a, r) => a + r.n, 0);
  return { total, customers: byRole.customer ?? 0, staff: total - (byRole.customer ?? 0) };
}

export async function getUser(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "User not found");
  await connectDB();
  const u = await User.findById(id).select(FIELDS).lean();
  if (!u) throw new ApiError("NOT_FOUND", "User not found");
  return toItem(u);
}

export async function createUser(input: CreateUserInput) {
  await connectDB();
  try {
    const u = await User.create({
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    });
    return getUser(String(u._id));
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new ApiError("CONFLICT", "A user with this email already exists", { email: "Already in use" });
    }
    throw err;
  }
}

const GUARD_ID = "superadmin-guard";

async function ensureGuardDoc() {
  try {
    await mongoose.connection.collection<{ _id: string; n: number }>("locks")
      .updateOne({ _id: GUARD_ID }, { $setOnInsert: { n: 0 } }, { upsert: true });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err; // concurrent first insert is fine
  }
}

/**
 * Update a user. Rules:
 *  - you cannot change your own role or deactivate yourself;
 *  - the last active superadmin cannot be demoted or deactivated;
 *  - role / active / password changes bump tokenVersion, which revokes the user's existing sessions.
 *
 * Runs in a transaction. Anything that removes a superadmin first writes a shared lock document, so two
 * concurrent demotions conflict and one is retried against fresh data (snapshot isolation alone would
 * allow both to pass the "others exist" check).
 */
export async function updateUser(actorId: string, id: string, input: UpdateUserInput) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "User not found");
  await connectDB();
  const passwordHash = input.password !== undefined ? await hashPassword(input.password) : undefined;
  await ensureGuardDoc();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const target = await User.findById(id).select("role isActive").session(session).lean();
      if (!target) throw new ApiError("NOT_FOUND", "User not found");

      const roleChanges = input.role !== undefined && input.role !== target.role;
      const activeChanges = input.isActive !== undefined && input.isActive !== target.isActive;

      if (actorId === id && (roleChanges || input.isActive === false)) {
        throw new ApiError("CONFLICT", "You cannot change your own role or deactivate your own account");
      }
      if (target.role === "superadmin" && target.isActive && (roleChanges || input.isActive === false)) {
        await mongoose.connection.collection("locks").updateOne({ _id: GUARD_ID as never }, { $inc: { n: 1 } }, { session });
        const others = await User.countDocuments({ role: "superadmin", isActive: true, _id: { $ne: id } }).session(session);
        if (others === 0) throw new ApiError("CONFLICT", "At least one active superadmin is required");
      }

      const set: Record<string, unknown> = {};
      if (input.name !== undefined) set.name = input.name;
      if (input.role !== undefined) set.role = input.role;
      if (input.isActive !== undefined) set.isActive = input.isActive;
      if (passwordHash !== undefined) set.passwordHash = passwordHash;

      const update: Record<string, unknown> = { $set: set };
      if (roleChanges || activeChanges || passwordHash !== undefined) update.$inc = { tokenVersion: 1 };
      await User.updateOne({ _id: id }, update, { session });
    });
  } finally {
    await session.endSession();
  }
  return getUser(id);
}

/** Fresh session claims for a user (used to re-issue the cookie after a self password change). */
export async function getSessionClaims(id: string) {
  await connectDB();
  const u = await User.findById(id).select("role tokenVersion").lean();
  if (!u) throw new ApiError("NOT_FOUND", "User not found");
  return { uid: id, role: u.role, tv: u.tokenVersion ?? 0 };
}
