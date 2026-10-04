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
import { requireEmployee } from "@/lib/auth/session";
import prisma from "@/lib/db";

const ADMIN_ROLE = "ADMIN" as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Require authenticated employee
  const authResult = await requireEmployee();
  if (authResult instanceof Response) return authResult;

  const { employee } = authResult;
  const { id } = await params;
  const ticketId = parseInt(id, 10);

  if (isNaN(ticketId)) {
    return NextResponse.json({ error: "Invalid ticket ID." }, { status: 400 });
  }

  // 2. Build the query — employees scoped to their own tickets only
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      // ADMIN can see any ticket; EMPLOYEE only their own
      ...(employee.appRole === ADMIN_ROLE
        ? {}
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
      employee: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!ticket) {
    // Return 404 for both "not found" and "unauthorized access" to avoid
    // leaking ticket existence to employees who don't own the ticket.
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}
