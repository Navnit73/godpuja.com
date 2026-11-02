import { connectDB } from "../db";
import { AuditLog } from "../models/AuditLog";

type Actor = { _id: unknown; name: string };

/** Record an admin write. Callers log after the write succeeded; a logging failure is reported, not hidden. */
export async function audit(actor: Actor, action: string, target: { type: string; id: string }, fields: string[] = [], ip = "") {
  await connectDB();
  await AuditLog.create({ action, actor: { id: String(actor._id), name: actor.name }, target, fields, ip });
}

export async function auditTrail(type: string, id: string, limit = 50) {
  await connectDB();
  const rows = await AuditLog.find({ "target.type": type, "target.id": id }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((r) => ({ action: r.action, actor: r.actor.name, fields: r.fields, at: r.createdAt.toISOString() }));
}
