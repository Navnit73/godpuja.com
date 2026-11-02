import mongoose, { type Model } from "mongoose";

// Append-only record of security-relevant admin writes (users today; orders keep their own per-order history).
// Stores which fields changed, never their values (no password hashes, no personal data beyond the actor's name).
const schema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // e.g. "user.create", "user.update"
    actor: { id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, name: { type: String, required: true } },
    target: { type: { type: String, required: true }, id: { type: String, required: true } },
    fields: { type: [String], default: [] },
    ip: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
schema.index({ "target.type": 1, "target.id": 1, createdAt: -1 });
schema.index({ createdAt: -1 });
export type AuditLogDoc = {
  action: string; actor: { id: mongoose.Types.ObjectId; name: string }; target: { type: string; id: string }; fields: string[]; ip: string; createdAt: Date;
};
if (process.env.NODE_ENV !== "production") delete mongoose.models.AuditLog;
export const AuditLog: Model<AuditLogDoc> = (mongoose.models.AuditLog as Model<AuditLogDoc>) || mongoose.model<AuditLogDoc>("AuditLog", schema as never);
