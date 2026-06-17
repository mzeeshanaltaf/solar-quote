import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next.js 16 renamed `middleware` to `proxy`. This runs before /admin routes
// and does a cheap, OPTIMISTIC auth check: is a session cookie present at all?
// If not, bounce to the login page before rendering anything.
//
// This is intentionally not a full session validation — the real check (does
// the session exist and is it valid) happens in app/admin/layout.tsx via
// auth.api.getSession, which is the authoritative guard. The proxy just saves a
// render for the obvious unauthenticated case. See the Next docs' note that
// auth must be enforced in the route, not relied on at the proxy alone.
export function proxy(request: NextRequest) {
  // The login page itself must stay reachable while logged out.
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
