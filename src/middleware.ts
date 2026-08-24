import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "uca_session";

/**
 * Edge-level gate: only checks cookie presence for routing.
 * Real authorization always happens server-side in layouts/route handlers.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const protectedPath = pathname.startsWith("/student") || pathname.startsWith("/admin");

  if (protectedPath && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/admin/:path*"],
};
