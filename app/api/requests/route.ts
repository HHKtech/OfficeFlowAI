/**
 * app/api/requests/route.ts  – P9 full multi-agent workflow
 *
 * POST /api/requests
 *   1. Validate session (employee from Neon Auth – never from body)
 *   2. Validate body
 *   3. Generate requestId
 *   4. Invoke Orchestrator (parallel agents, real tools, real DB)
 *   5. Collect ticketIds from typed AgentResults (no broad createdAt queries)
 *   6. Return structured JSON: requestId, issuesDetected, agentsUsed,
 *      ticketsCreated, requiresApproval, finalResponse
 *
 * GET /api/requests – health probe (unauthenticated)
 *
 * SECURITY:
 *  - employeeId always from session, never from request body
 *  - Orchestrator errors return safe 500 JSON – no stack traces exposed
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/session";
import { runOrchestrator } from "@/agents/orchestrator";
import { randomUUID } from "crypto";
import { z } from "zod";

const RequestBodySchema = z.object({
  description: z.string().trim().min(1).max(10_000),
}).strict();

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const authResult = await requireEmployee();
  if (authResult instanceof Response) return authResult;
  const { employee } = authResult;

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "description is required and must be a non-empty string of 10,000 characters or fewer." },
      { status: 400 },
    );
  }

  const description = parsed.data.description;

  // 3. Generate request ID
  const requestId = randomUUID();

  // 4. Run orchestrator – never throws (all errors isolated internally)
  try {
    const result = await runOrchestrator({ employeeId: employee.id, message: description, requestId });

    // 5. Ticket IDs come from typed AgentResults – no broad DB query needed
    const ticketsCreated = result.ticketsCreated.map(String);
    const requiresApproval = result.requiresApproval;

    // 6. Return structured response per P9 spec
    return NextResponse.json({
      requestId: result.requestId,
      issuesDetected: result.issuesDetected,
      agentsUsed: result.agentsUsed,
      ticketsCreated,
      requiresApproval,
      finalResponse: result.finalResponse,
    });
  } catch {
    // Orchestrator itself should never throw, but belt-and-suspenders
    return NextResponse.json(
      {
        requestId,
        issuesDetected: 0,
        agentsUsed: ["orchestrator"],
        ticketsCreated: [],
        requiresApproval: false,
        finalResponse: "We encountered an error processing your request. Please try again later.",
      },
      { status: 500 }
    );
  }
}
