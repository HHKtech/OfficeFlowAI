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
 * Protected page routes redirect unauthenticated visitors to /login.
 */

import { auth } from "@/lib/auth/server";
import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth/demo";

const neonAuthMiddleware = auth.middleware({ loginUrl: "/login" });

export default function proxy(request: Parameters<typeof neonAuthMiddleware>[0]) {
  if (request.cookies.has(DEMO_SESSION_COOKIE)) return NextResponse.next();
  return neonAuthMiddleware(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/tickets/:path*", "/request/:path*", "/admin/:path*"],
};
