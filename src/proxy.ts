import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/constants";

/**
 * Proxy — Next.js 16's replacement for `middleware.ts`.
 *
 * This performs *optimistic* checks only: it looks at whether a session cookie
 * is present, and never at whether it is valid. Two reasons, both from the
 * framework's own guidance:
 *
 *  1. Proxy runs on every matched request including prefetches, so a database
 *     round trip here would multiply load for no benefit.
 *  2. Proxy may be deployed to the CDN edge, separately from the render path,
 *     so it cannot be relied on to share code or connections with the app.
 *
 * The real authorization happens in the Data Access Layer (`src/lib/dal.ts`),
 * which every protected page calls. This layer exists purely to save an
 * unauthenticated visitor a wasted render before that redirect — a forged
 * cookie gets past this file and is then rejected by the DAL, which is the
 * intended division of labour, not a gap.
 */

/** Route prefixes that require a session. */
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/subscribe", "/account"];

/** Routes a signed-in user should be bounced away from. */
const GUEST_ONLY_PATHS = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    // Preserve where they were heading so sign-in returns them there.
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);

    return NextResponse.redirect(loginUrl);
  }

  if (GUEST_ONLY_PATHS.includes(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Skip Next.js internals, static assets and API routes.
   *
   * `/api` is excluded deliberately: the Stripe webhook authenticates by
   * signature, not by cookie, and must never be redirected — a redirect would
   * be read by Stripe as a delivery failure and trigger retries of an event
   * that was never actually processed.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
