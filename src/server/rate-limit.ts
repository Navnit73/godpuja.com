import { ApiError } from "./api";
import { connectDB } from "./db";
import { env } from "./env";
import { RateLimit } from "./models/RateLimit";

const limited = (retryAfterSec: number) =>
  new ApiError("RATE_LIMITED", "Too many requests, try again later", undefined, { "Retry-After": String(Math.max(1, retryAfterSec)) });

// ---------------------------------------------------------------------------------------------------------------
// In-memory limiter (per instance). Used for high-volume public reads where a DB round trip per request would cost
// more than it protects (catalog API, cart validation, search). It dampens abuse on one instance; it is not a
// guarantee across instances. Security-sensitive limits use the shared limiter below.
// ---------------------------------------------------------------------------------------------------------------
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
  if (entry.count > limit) throw limited(Math.ceil((entry.reset - now) / 1000));
}

/** Throw if `key` has already reached `limit`, without counting this call. Pair with rateLimit() on failures only. */
export function rateLimitPeek(key: string, limit: number) {
  const entry = hits.get(key);
  if (entry && entry.reset >= Date.now() && entry.count >= limit) throw limited(Math.ceil((entry.reset - Date.now()) / 1000));
}

export const _resetRateLimit = () => hits.clear();

// ---------------------------------------------------------------------------------------------------------------
// Shared limiter (MongoDB). Fixed windows aligned to the clock: one atomic $inc upsert per call, so concurrent
// requests on different instances count against the same document. Used for login, registration, checkout and
// newsletter sign-up, where per-instance counting would let an attacker multiply the limit by the instance count.
// ---------------------------------------------------------------------------------------------------------------
const windowOf = (windowMs: number, now = Date.now()) => {
  const start = Math.floor(now / windowMs) * windowMs;
  return { start, end: start + windowMs };
};
const docId = (key: string, start: number) => `${key}@${start}`;

export async function rateLimitShared(key: string, limit: number, windowMs: number) {
  await connectDB();
  const now = Date.now();
  const { start, end } = windowOf(windowMs, now);
  const _id = docId(key, start);
  const inc = () => RateLimit.findOneAndUpdate(
    { _id },
    // TTL removal runs about once a minute; the extra minute only keeps the document past its window, never shortens it.
    { $inc: { n: 1 }, $setOnInsert: { expiresAt: new Date(end + 60_000) } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  let doc;
  try {
    doc = await inc();
  } catch (err) {
    // Two first-hits in the same window can both try to insert; the loser retries as a plain increment.
    if ((err as { code?: number }).code !== 11000) throw err;
    doc = await inc();
  }
  if (doc && doc.n > limit) throw limited(Math.ceil((end - now) / 1000));
}

/** Shared-store counterpart of rateLimitPeek: throws once `limit` failures were recorded, without counting. */
export async function rateLimitSharedPeek(key: string, limit: number, windowMs: number) {
  await connectDB();
  const now = Date.now();
  const { start, end } = windowOf(windowMs, now);
  const doc = await RateLimit.findById(docId(key, start)).select("n").lean();
  if (doc && doc.n >= limit) throw limited(Math.ceil((end - now) / 1000));
}

// ---------------------------------------------------------------------------------------------------------------
// Client IP
// ---------------------------------------------------------------------------------------------------------------

/**
 * Client IP for rate limiting. Never trusts a value the client can set:
 *  - CLIENT_IP_HEADER set (e.g. "cf-connecting-ip", "x-real-ip"): that header, which the edge in front of the app
 *    must overwrite on every request;
 *  - otherwise X-Forwarded-For, counting TRUSTED_PROXY_HOPS entries from the right (default 1: the address appended
 *    by the single proxy/CDN in front of the app, e.g. Vercel or one nginx). Entries further left are client-supplied.
 * Returns "unknown" when the header is missing or shorter than the configured hops.
 */
export function pickClientIp(h: Headers, cfg: { header?: string; hops: number }) {
  if (cfg.header) return h.get(cfg.header)?.split(",")[0]?.trim() || "unknown";
  const parts = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return parts[parts.length - cfg.hops] ?? "unknown";
}

const ipConfig = () => ({ header: env().CLIENT_IP_HEADER || undefined, hops: env().TRUSTED_PROXY_HOPS });
export const clientIp = (req: Request) => pickClientIp(req.headers, ipConfig());
/** Same rule for Server Components, which get a Headers object rather than a Request. */
export const clientIpFromHeaders = (h: Headers) => pickClientIp(h, ipConfig());

/** Tests only: clear the shared counters. */
export async function _resetSharedRateLimit() {
  await connectDB();
  await RateLimit.deleteMany({});
}
