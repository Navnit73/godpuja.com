import { ApiError } from "./api";

// Fixed-window in-memory limiter. Per-instance only: replace with a shared store (Redis/Upstash)
// before running multiple server instances. Tracked for Stage 11.
const MAX_KEYS = 10_000;
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (hits.size >= MAX_KEYS) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    // Still full (attacker-chosen keys): evict oldest-inserted so memory stays bounded.
    for (const k of hits.keys()) {
      if (hits.size < MAX_KEYS) break;
      hits.delete(k);
    }
  }
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  entry.count++;
  if (entry.count > limit) {
    const retry = Math.ceil((entry.reset - now) / 1000);
    throw new ApiError("RATE_LIMITED", "Too many requests, try again later", undefined, {
      "Retry-After": String(retry),
    });
  }
}

/**
 * Client IP as appended by the nearest trusted proxy (last X-Forwarded-For entry).
 * The first entry is client-controlled and must not be used for limiting.
 * Assumes the app runs behind exactly one proxy/CDN that appends to the header (e.g. Vercel).
 */
export const clientIp = (req: Request) => {
  const parts = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return req.headers.get("x-real-ip") || parts?.[parts.length - 1] || "unknown";
};

export const _resetRateLimit = () => hits.clear();
