/**
 * lib/auth/server.ts
 *
 * Neon Auth (Managed Better Auth) server-side instance.
 *
 * SECURITY:
 * - This file is SERVER-ONLY. Never import from client components.
 * - NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET are server-only secrets.
 * - Never log session tokens, auth secrets, or sensitive auth payloads.
 */

import { createNeonAuth } from "@neondatabase/auth/next/server";

if (!process.env.NEON_AUTH_BASE_URL) {
  throw new Error(
    "NEON_AUTH_BASE_URL is not set. This must be a server-only environment variable."
  );
}
if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error(
    "NEON_AUTH_COOKIE_SECRET is not set. Generate one with: openssl rand -base64 32"
  );
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET },
});
