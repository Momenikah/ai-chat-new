import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth";

/**
 * Edge middleware: gate `/dashboard` behind an auth token, and bounce
 * already-authenticated users away from `/login` and `/register`.
 *
 * Note: this is a coarse gate. The API still enforces JWT validity and
 * role-based access on every request.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hasSession =
    Boolean(req.cookies.get(ACCESS_TOKEN_COOKIE)?.value) ||
    Boolean(req.cookies.get(REFRESH_TOKEN_COOKIE)?.value);

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  const isLanding = pathname === "/";

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in visitors skip the marketing page + auth pages and land in
  // the dashboard immediately.
  if ((isAuthPage || isLanding) && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/admin/:path*", "/login", "/register"],
};
