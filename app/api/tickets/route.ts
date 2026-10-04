/**
 * app/api/tickets/route.ts
 *
 * GET /api/tickets — Returns tickets for the currently authenticated employee.
 *
 * SECURITY:
 * - Requires a valid Neon Auth session with a linked Employee record.
 * - Tickets are scoped to the authenticated employee — never trusts a
 *   client-supplied employeeId.
 * - ADMIN users see all tickets; EMPLOYEE users see only their own.
 */

import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/session";
import prisma from "@/lib/db";

const ADMIN_ROLE = "ADMIN" as const;

export async function GET() {
  // 1. Require authenticated employee — 401 if not, 403 if no Employee record
  const authResult = await requireEmployee();
  if (authResult instanceof Response) return authResult;

  const { employee } = authResult;

  // 2. ADMIN sees all tickets; EMPLOYEE sees only their own
  const where =
    employee.appRole === ADMIN_ROLE
      ? {} // all tickets
      : { employeeId: employee.id }; // only this employee's tickets

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json({ tickets });
}
