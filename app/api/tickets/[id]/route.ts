/**
 * app/api/tickets/[id]/route.ts
 *
 * GET /api/tickets/[id] — Returns a single ticket.
 *
 * SECURITY:
 * - Requires a valid Neon Auth session with a linked Employee record.
 * - EMPLOYEE may only view their own tickets.
 * - ADMIN may view any ticket.
 * - Returns 404 (not 403) when employee tries to access another employee's
 *   ticket to avoid leaking whether the ticket exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminTeam, requireEmployee } from "@/lib/auth/session";
import prisma from "@/lib/db";
import { updateTicketStatus } from "@/services/ticket-service";
import { z } from "zod";

const ADMIN_ROLE = "ADMIN" as const;

const UpdateTicketBodySchema = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL", "RESOLVED", "REJECTED"]).optional(),
  approvalStatus: z.enum(["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedTo: z.string().trim().max(255).nullable().optional(),
}).strict().refine((value) => value.status !== undefined || value.approvalStatus !== undefined || value.priority !== undefined || value.assignedTo !== undefined);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Require authenticated employee
  const authResult = await requireEmployee();
  if (authResult instanceof Response) return authResult;

  const { employee } = authResult;
  const { id } = await params;
  const ticketId = Number(id);

  if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "Invalid ticket ID." }, { status: 400 });
  }

  // 2. Build the query — employees scoped to their own tickets only
  let ticket;
  try {
    ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(employee.appRole === ADMIN_ROLE
          ? { assignedTeam: authResult.operationalTeam ?? "__NO_TEAM__" }
          : { employeeId: employee.id }),
      },
      select: {
        id: true,
        category: true,
        subcategory: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        assignedTeam: true,
        assignedTo: true,
        requiresApproval: true,
        approvalStatus: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true, name: true, email: true } },
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load ticket." }, { status: 500 });
  }

  if (!ticket) {
    // Return 404 for both "not found" and "unauthorized access" to avoid
    // leaking ticket existence to employees who don't own the ticket.
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminTeam();
  if (authResult instanceof Response) return authResult;

  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "Invalid ticket ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = UpdateTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "At least one valid update field is required." }, { status: 400 });
  }

  try {
    const existing = await prisma.ticket.findFirst({
      where: { id: ticketId, assignedTeam: authResult.operationalTeam! },
      select: { status: true },
    });
    if (!existing) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    const ticket = await updateTicketStatus(
      ticketId,
      parsed.data.status ?? existing.status,
      parsed.data.approvalStatus,
      { priority: parsed.data.priority, assignedTo: parsed.data.assignedTo },
    );
    return NextResponse.json({ ticket });
  } catch {
    return NextResponse.json({ error: "Unable to update ticket." }, { status: 500 });
  }
}
