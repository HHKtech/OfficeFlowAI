/**
 * app/api/auth/[...path]/route.ts
 *
 * Neon Auth (Managed Better Auth) catch-all proxy route.
 *
 * This forwards all auth requests (sign-in, sign-up, session, sign-out, etc.)
 * to the Neon Auth managed service. The browser auth client communicates with
 * this route — it never talks directly to NEON_AUTH_BASE_URL.
 *
 * SECURITY: This route is intentionally public — authentication flows
 * (sign-in, sign-up, etc.) must be reachable without a session.
 * Do NOT add auth guards to this route handler.
 */

import { auth } from "@/lib/auth/server";

export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
