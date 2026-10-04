/**
 * lib/auth/client.ts
 *
 * Neon Auth client for browser-side use.
 *
 * This client calls the same-origin /api/auth proxy route — it does NOT
 * receive or store NEON_AUTH_BASE_URL directly. No secrets are exposed here.
 *
 * Usage: import { authClient } from "@/lib/auth/client"
 */

"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// The browser client takes NO arguments — it uses the same-origin proxy
// route at /api/auth/[...path] automatically.
export const authClient = createAuthClient();
