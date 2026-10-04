/**
 * lib/auth/session.ts
 *
 * Server-side authentication and authorization helpers for OfficeFlow AI.
 *
 * SECURITY RULES:
 * 1. Authentication is determined ONLY from Neon Auth session — never from
 *    request body, URL params, query params, or headers provided by the client.
 * 2. The Employee record is looked up using authUserId from the session —
 *    never from an employeeId supplied by the browser.
 * 3. Application roles (EMPLOYEE / ADMIN) are read from the Employee DB record
 *    — never from the session token or client request.
 * 4. Gemini / AI models NEVER determine authentication or authorization.
 * 5. Never log session tokens, auth secrets, or sensitive auth payloads.
 *
 * Flow:
 *   Request → Neon Auth session → authUserId → Employee record → appRole
 */

import { auth } from "@/lib/auth/server";
import prisma from "@/lib/db";
import { AppRole } from "@prisma/client";

// Use a string constant to avoid importing the Prisma-generated AppRole enum
// (which would fail in test environments before `prisma generate` has run).
// The value matches the AppRole enum: "ADMIN"
const ADMIN_ROLE = "ADMIN" as const;


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthenticatedSession {
  authenticated: true;
  authUserId: string;
  email: string | null;
  name: string | null;
}

export interface UnauthenticatedSession {
  authenticated: false;
}

export type SessionResult = AuthenticatedSession | UnauthenticatedSession;

export interface AuthorizedEmployee {
  authenticated: true;
  authUserId: string;
  email: string | null;
  name: string | null;
  employee: {
    id: number;
    name: string;
    email: string;
    department: string;
    role: string;
    appRole: AppRole;
    authUserId: string;
  };
}

// ---------------------------------------------------------------------------
// getCurrentSession
// ---------------------------------------------------------------------------

/**
 * Returns the current Neon Auth session without throwing.
 * Safe to call from any server-side handler.
 *
 * Returns { authenticated: false } when there is no valid session.
 */
export async function getCurrentSession(): Promise<SessionResult> {
  try {
    const { data: session, error } = await auth.getSession();
    if (error || !session?.user) {
      return { authenticated: false };
    }
    return {
      authenticated: true,
      authUserId: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
    };
  } catch {
    // Never surface auth internals — return unauthenticated safely
    return { authenticated: false };
  }
}

// ---------------------------------------------------------------------------
// requireAuthenticatedUser
// ---------------------------------------------------------------------------

/**
 * Asserts that the current request has a valid Neon Auth session.
 * Returns a 401 Response if not authenticated.
 *
 * Usage:
 *   const result = await requireAuthenticatedUser();
 *   if (result instanceof Response) return result;
 *   // result.authUserId is now trusted
 */
export async function requireAuthenticatedUser(): Promise<
  AuthenticatedSession | Response
> {
  const session = await getCurrentSession();
  if (!session.authenticated) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  return session;
}

// ---------------------------------------------------------------------------
// requireEmployee
// ---------------------------------------------------------------------------

/**
 * Asserts that the current request has a valid Neon Auth session AND that
 * the authenticated user has a matching Employee record.
 *
 * Returns:
 *   - 401 Response if not authenticated
 *   - 403 Response if authenticated but no matching Employee record
 *   - AuthorizedEmployee if fully authorized as an employee
 *
 * CRITICAL: The Employee is looked up by authUserId from the session —
 * NEVER from any employeeId supplied by the client request.
 */
export async function requireEmployee(): Promise<
  AuthorizedEmployee | Response
> {
  const authResult = await requireAuthenticatedUser();
  if (authResult instanceof Response) return authResult;

  const employee = await prisma.employee.findUnique({
    where: { authUserId: authResult.authUserId },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      role: true,
      appRole: true,
      authUserId: true,
    },
  });

  if (!employee || !employee.authUserId) {
    return Response.json(
      { error: "Forbidden: No employee account linked to this user." },
      { status: 403 }
    );
  }

  return {
    authenticated: true,
    authUserId: authResult.authUserId,
    email: authResult.email,
    name: authResult.name,
    employee: employee as AuthorizedEmployee["employee"],
  };
}

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

/**
 * Asserts that the current request has a valid Neon Auth session, a matching
 * Employee record, AND that the Employee has the ADMIN role.
 *
 * Returns:
 *   - 401 Response if not authenticated
 *   - 403 Response if authenticated but no matching Employee or not ADMIN
 *   - AuthorizedEmployee (with appRole ADMIN) if fully authorized
 *
 * CRITICAL: The role is read from the Employee DB record —
 * NEVER from the request body, URL params, or token claims.
 */
export async function requireAdmin(): Promise<
  AuthorizedEmployee | Response
> {
  const result = await requireEmployee();
  if (result instanceof Response) return result;

  if (result.employee.appRole !== ADMIN_ROLE) {
    return Response.json(
      { error: "Forbidden: Admin access required." },
      { status: 403 }
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// getEmployeeFromSession
// ---------------------------------------------------------------------------

/**
 * Returns the Employee record for the current session user, or null.
 * Does NOT throw or return a Response — use in contexts where you want
 * optional employee context (e.g. public routes that become richer with auth).
 */
export async function getEmployeeFromSession() {
  const session = await getCurrentSession();
  if (!session.authenticated) return null;

  return prisma.employee.findUnique({
    where: { authUserId: session.authUserId },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      role: true,
      appRole: true,
      authUserId: true,
    },
  });
}
