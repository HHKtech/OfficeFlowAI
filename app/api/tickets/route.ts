/**
 * app/api/tickets/route.ts
 *
 * GET /api/tickets — Returns tickets for the currently authenticated employee.
 *
 * SECURITY:
 * - Requires a valid Neon Auth session with a linked Employee record.
 * - Tickets are scoped to the authenticated employee — never trusts a
 *   client-supplied employeeId.
 * - ADMIN users see only tickets assigned to their operational team.
 * - EMPLOYEE users see only their own.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/session";
import { createTicket, getTicketsForEmployee } from "@/services/ticket-service";
import { z } from "zod";

const ADMIN_ROLE = "ADMIN" as const;

const CreateTicketBodySchema = z.object({
  category: z.enum(["IT", "FACILITIES", "SECURITY"]),
  subcategory: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(10_000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  assignedTeam: z.string().trim().min(1).max(100),
  assignedTo: z.string().trim().max(255).optional(),
  requiresApproval: z.boolean().optional(),
}).strict();

export async function GET() {
  // 1. Require authenticated employee — 401 if not, 403 if no Employee record
  const authResult = await requireEmployee();
  if (authResult instanceof Response) return authResult;

  const { employee } = authResult;

  // 2. ADMIN sees all tickets; EMPLOYEE sees only their own
  const where =
    employee.appRole === ADMIN_ROLE
      ? { assignedTeam: authResult.operationalTeam ?? "__NO_TEAM__" }
      : { employeeId: employee.id }; // only this employee's tickets

  try {
    const tickets = await getTicketsForEmployee(where);
    return NextResponse.json({ tickets });
  } catch {
    return NextResponse.json({ error: "Unable to load tickets." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireEmployee();
  if (authResult instanceof Response) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CreateTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ticket fields." }, { status: 400 });
  }

  try {
    const ticket = await createTicket({
      ...parsed.data,
      employeeId: authResult.employee.id,
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create ticket." }, { status: 500 });
  }
}
