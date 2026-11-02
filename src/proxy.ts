import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";
import { isStaff } from "@/server/auth/permissions";

// Coarse gate only. Every admin page and API handler re-checks authoritatively (see server/auth/guard.ts).
export async function proxy(req: NextRequest) {
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
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
