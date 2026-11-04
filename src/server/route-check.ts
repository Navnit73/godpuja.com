import { connectDB } from "./db";
import { Category } from "./models/Category";
import { Page } from "./models/Page";
import { Product } from "./models/Product";
import { loadRedirectMap } from "./services/redirects";
import { RESERVED_SLUGS, validateSlug } from "@/lib/slug";
import { vidhiExists } from "./services/vidhi";

/**
 * Fast, in-process lookups used by the proxy BEFORE a page starts streaming, so redirects get a real 301 and unknown
 * URLs a real 404 (a status cannot change once streaming has begun). Results are cached per server instance:
 * redirect table 60 s, positive answers 60 s, negative answers 15 s. Pages still render their own not-found UI
 * (with noindex) if something changes inside those windows.
 */
type Entry = { ok: boolean; at: number };
const POS_TTL = 60_000, NEG_TTL = 15_000, MAX = 5_000;
const known = new Map<string, Entry>();
let redirects: { map: Map<string, string>; at: number } | null = null;
let loading: Promise<Map<string, string>> | null = null;

export async function redirectFor(path: string): Promise<string | null> {
  if (!redirects || Date.now() - redirects.at > 60_000) {
    loading ??= loadRedirectMap().then((map) => { redirects = { map, at: Date.now() }; return map; }).finally(() => { loading = null; });
    try { await loading; } catch { return null; } // DB down: never block the site on the redirect table
  }
  return redirects?.map.get(path) ?? null;
}

async function cached(key: string, check: () => Promise<boolean>): Promise<boolean> {
  const hit = known.get(key);
  if (hit && Date.now() - hit.at < (hit.ok ? POS_TTL : NEG_TTL)) return hit.ok;
  let ok: boolean;
  try { await connectDB(); ok = await check(); } catch { return true; } // fail open: the page decides
  if (known.size >= MAX) known.delete(known.keys().next().value!);
  known.set(key, { ok, at: Date.now() });
  return ok;
}

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATIC = new Set(["cart", "checkout", "shop", "pooja-vidhi", "search", "login", "register", "forgot-password", "reset-password", "verify-email", "page-not-found", "blog", "guides"]); // blog/guides: index pages; their posts are CMS pages below

export type RouteVerdict = { kind: "ok" } | { kind: "notFound" };

/** Does this storefront path exist? Only paths we own are judged; anything else is left to the app. */
export async function checkPath(path: string): Promise<RouteVerdict> {
  if (path === "/") return { kind: "ok" };
  const parts = path.slice(1).split("/");
  const [first, ...rest] = parts;
  if (STATIC.has(first) && rest.length === 0) return { kind: "ok" };
  if (first === "order" || first === "preview") return { kind: "ok" }; // token routes validate themselves
  if (first === "product") {
    const slug = rest.join("/");
    if (rest.length !== 1 || !SEGMENT.test(slug) || slug.length > 80) return { kind: "notFound" };
    return (await cached(`p:${slug}`, async () => !!(await Product.exists({ slug, status: { $in: ["active", "upcoming"] } })))) ? { kind: "ok" } : { kind: "notFound" };
  }
  if (first === "pooja-vidhi") {
    // /pooja-vidhi/<slug>: a live guide, else a real 404 (the index itself is in STATIC above).
    const slug = rest.join("/");
    if (rest.length !== 1 || !SEGMENT.test(slug) || slug.length > 80) return { kind: "notFound" };
    return (await cached(`v:${slug}`, () => vidhiExists(slug))) ? { kind: "ok" } : { kind: "notFound" };
  }
  if (first === "shop" || first === "category") {
    const p = rest.join("/");
    if (rest.length < 1 || rest.length > 3 || !rest.every((s) => SEGMENT.test(s))) return { kind: "notFound" };
    return (await cached(`c:${p}`, async () => !!(await Category.exists({ path: p, isActive: true })))) ? { kind: "ok" } : { kind: "notFound" };
  }
  if ((RESERVED_SLUGS as readonly string[]).includes(first)) return { kind: "ok" }; // app-owned; let Next decide
  const slug = parts.join("/");
  if (validateSlug(slug)) return { kind: "notFound" };
  return (await cached(`g:${slug}`, async () => {
    const now = new Date();
    return !!(await Page.exists({ slug, $or: [{ status: "published" }, { status: "scheduled", publishAt: { $lte: now } }] }));
  })) ? { kind: "ok" } : { kind: "notFound" };
}

export const _resetRouteCache = () => { known.clear(); redirects = null; };
