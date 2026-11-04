import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";
import { isStaff } from "@/server/auth/permissions";
import { legacyToShop } from "@/lib/shop-url";
import { checkPath, redirectFor } from "@/server/route-check";

const isAdmin = (p: string) => p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin/");
const isAccount = (p: string) => p === "/account" || p.startsWith("/account/");

// Coarse admin gate only. Every admin page and API handler re-checks authoritatively (see server/auth/guard.ts).
async function adminGate(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = req.nextUrl;
  if (!session || !isStaff(session.role)) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { error: { code: session ? "FORBIDDEN" : "UNAUTHENTICATED", message: "Not allowed" } },
        { status: session ? 403 : 401 },
      );
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // Let the admin layout redirect stale sessions back to the page that was requested.
  const headers = new Headers(req.headers);
  headers.set("x-next-path", pathname + search);
  return NextResponse.next({ request: { headers } });
}

/**
 * Storefront: decide the HTTP status BEFORE the page streams (afterwards it is fixed at 200).
 * Malformed URL -> 400 · recorded redirect -> 301 · unknown product/category/page -> real 404.
 */
async function storefront(req: NextRequest) {
  if (req.method !== "GET" && req.method !== "HEAD") return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  // Customer account pages need a session (coarse check; pages re-check against the database).
  if (isAccount(pathname) && !(await verifySession(req.cookies.get(SESSION_COOKIE)?.value))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return new NextResponse("Bad request", { status: 400, headers: { "content-type": "text/plain" } });
  }
  const key = (path.length > 1 ? path.replace(/\/+$/, "") : path).toLowerCase();
  const to = await redirectFor(key);
  // Redirects stored before Stage 14 may still point at /category/...: send people straight to /shop/... (one hop).
  if (to) return NextResponse.redirect(/^https?:\/\//.test(to) ? to : new URL((legacyToShop(to) ?? to) + search, req.url), 301);
  const legacy = legacyToShop(key); // /category/<path> was renamed to /shop/<path>
  if (legacy) return NextResponse.redirect(new URL(legacy + search, req.url), 301);
  if ((await checkPath(path)).kind === "notFound") return NextResponse.rewrite(new URL("/page-not-found", req.url));
  return NextResponse.next();
}

export async function proxy(req: NextRequest) {
  return isAdmin(req.nextUrl.pathname) ? adminGate(req) : storefront(req);
}

// Everything except API routes (other than /api/admin), Next internals and files with an extension
// (static assets, sitemap.xml, robots.txt, icons).
export const config = { matcher: ["/api/admin/:path*", "/((?!api/|_next/|.*\\.[a-z0-9]+$).*)"] };
