// Shared (client + server safe). PRD v1.1 §9: "Store media rights/permission metadata and remove content when rights expire or are withdrawn."
type Rights = { source?: string | null; licence?: string | null; reference?: string | null; expiresAt?: Date | string | null; withdrawn?: boolean | null };

export type AudioStatus = "none" | "ok" | "expiring" | "expired" | "withdrawn" | "unlicensed";
const SOON_MS = 30 * 24 * 3600 * 1000;

/** Why audio is (not) offered. Only "ok" and "expiring" mean the recording may play. */
export function audioStatus(audioUrl: string | null | undefined, r: Rights | null | undefined, now = new Date()): AudioStatus {
  if (!audioUrl) return "none";
  if (r?.withdrawn) return "withdrawn";
  if (!r?.source || !r.licence || (r.licence === "licensed" && !r.reference)) return "unlicensed";
  if (r.expiresAt) {
    const at = new Date(r.expiresAt).getTime();
    if (at <= now.getTime()) return "expired";
    if (at - now.getTime() <= SOON_MS) return "expiring";
  }
  return "ok";
}
export const audioPlayable = (s: AudioStatus) => s === "ok" || s === "expiring";

/** Field name -> message. Empty object = ready to publish or schedule. */
export function publishProblems(v: { lyrics?: string | null; reviewer?: string | null; reviewedAt?: unknown }): Record<string, string> {
  const f: Record<string, string> = {};
  if (!v.lyrics?.trim()) f.lyrics = "Add the text before publishing";
  if (!v.reviewer?.trim()) f.reviewer = "Name who reviewed this for accuracy before publishing";
  if (!v.reviewedAt) f.reviewedAt = "Add the date it was reviewed before publishing";
  return f;
}
