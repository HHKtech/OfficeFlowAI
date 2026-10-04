/**
 * app/api/requests/route.ts
 *
 * POST /api/requests — Submit a new OfficeFlow AI request (creates a ticket
 * via the Orchestrator Agent).
 *
 * SECURITY:
 * - Requires a valid Neon Auth session with a linked Employee record.
 * - The Employee identity comes from the session — NOT from the request body.
 *   An employeeId in the request body is IGNORED to prevent impersonation.
 * - The AI model never determines authentication or authorization.
 *
 * GET /api/requests — Returns a status check (public, for infra health probes).
 */

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/session";

/**
 * GET /api/requests
 * Public health-check / infra probe — intentionally unauthenticated.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

/**
 * POST /api/requests
 *
 * Body: { description: string }
 *
 * The employeeId used for ticket creation is derived from the authenticated
 * session — any employeeId in the body is ignored.
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate and resolve Employee from session — never from body
  const authResult = await requireEmployee();
  if (authResult instanceof Response) return authResult;

  const { employee } = authResult;

  // 2. Parse request body — note: we do NOT read employeeId from body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).description !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing required field: description (string)." },
      { status: 400 }
    );
  }

  const description = (body as Record<string, unknown>).description as string;

  if (!description.trim()) {
    return NextResponse.json(
      { error: "description must not be empty." },
      { status: 400 }
    );
  }

  // 3. The trusted employeeId comes from the session — never from the client
  // Orchestrator agent is invoked here in future prompts.
  // For now: return the trusted employee context so the layer is testable.
  return NextResponse.json({
    status: "accepted",
    employeeId: employee.id, // trusted — from session, not body
    message: "Request received. Agent processing will be wired in the next prompt.",
  });
}
