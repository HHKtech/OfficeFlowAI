/**
 * middleware.ts (Next.js App Router middleware)
 *
 * Neon Auth session middleware — refreshes/validates session cookies on
 * protected routes. API routes enforce auth themselves via requireEmployee()
 * / requireAdmin() — this middleware handles page-level session caching.
 *
 * The matcher deliberately excludes:
 * - /api/auth/* — the auth proxy route (must be public)
 * - /_next/* — Next.js build assets
 * - /favicon.ico, /public static files
 *
 * NOTE: This middleware does NOT redirect to a login page yet — that will
 * be added when the auth UI is built. Currently it only refreshes session
 * cookies so server components can read them.
 */

import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /api/auth/* (Neon Auth proxy — must be accessible without session)
     * - /_next/static/* (static files)
     * - /_next/image/* (image optimization)
     * - /favicon.ico
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
