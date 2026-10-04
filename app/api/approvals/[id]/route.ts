/**
 * app/api/approvals/[id]/route.ts
 *
 * PATCH /api/approvals/[id] — Approve or reject a ticket requiring approval.
 *
 * SECURITY:
 * - Requires ADMIN role. Employees cannot approve tickets.
 * - The admin's identity comes from the session — never from the request body.
 * - Returns 401 if unauthenticated, 403 if not an ADMIN.
 *
 * Body: { decision: "APPROVED" | "REJECTED" }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import prisma from "@/lib/db";
import { ApprovalStatus, TicketStatus } from "@prisma/client";

export async function GET() {
  // Public status endpoint (kept from previous work)
  return NextResponse.json({ status: "ok" });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Require ADMIN — 401 if unauthenticated, 403 if not admin
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const { id } = await params;
  const ticketId = parseInt(id, 10);

  if (isNaN(ticketId)) {
    return NextResponse.json({ error: "Invalid ticket ID." }, { status: 400 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const decision = (body as Record<string, unknown>)?.decision as string;

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return NextResponse.json(
      { error: 'decision must be "APPROVED" or "REJECTED".' },
      { status: 400 }
    );
  }

  // 3. Find and update ticket
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requiresApproval: true, approvalStatus: true },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  if (!ticket.requiresApproval) {
    return NextResponse.json(
      { error: "This ticket does not require approval." },
      { status: 400 }
    );
  }

  if (ticket.approvalStatus !== "PENDING") {
    return NextResponse.json(
      { error: `Ticket approval is already ${ticket.approvalStatus}.` },
      { status: 409 }
    );
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      approvalStatus: decision as ApprovalStatus,
      status:
        decision === "APPROVED"
          ? TicketStatus.IN_PROGRESS
          : TicketStatus.REJECTED,
    },
    select: { id: true, status: true, approvalStatus: true },
  });

  return NextResponse.json({ ticket: updated });
}
