/**
 * app/api/approvals/[id]/route.ts
 *
 * PATCH /api/approvals/[id] — Approve or reject a ticket requiring approval.
 *
 * SECURITY:
 * - Requires the SECURITY ADMIN operational team. Other admins and employees
 *   cannot approve Security tickets.
 * - The admin's identity comes from the session — never from the request body.
 * - Returns 401 if unauthenticated, 403 if not an ADMIN.
 *
 * Body: { decision: "APPROVED" | "REJECTED" }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminTeam } from "@/lib/auth/session";
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
  return processApproval(req, params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return processApproval(req, params);
}

async function processApproval(
  req: NextRequest,
  params: Promise<{ id: string }>,
) {
  // 1. Require the Security Admin team — 401 if unauthenticated, 403 otherwise
  const authResult = await requireAdminTeam();
  if (authResult instanceof Response) return authResult;
  if (authResult.operationalTeam !== "SECURITY") {
    return NextResponse.json(
      { error: "Forbidden: Security Admin approval required." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const ticketId = Number(id);

  if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
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

  // 3. Find the ticket in the Security approval workflow
  let ticket;
  try {
    ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, assignedTeam: "SECURITY", category: "SECURITY" },
      select: { id: true, requiresApproval: true, approvalStatus: true, status: true },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load approval." }, { status: 500 });
  }

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

  // The state predicates make approval one-shot even when two requests race.
  let updateResult;
  try {
    updateResult = await prisma.ticket.updateMany({
      where: {
        id: ticketId,
        category: "SECURITY",
        assignedTeam: "SECURITY",
        requiresApproval: true,
        approvalStatus: "PENDING",
        status: "AWAITING_APPROVAL",
      },
      data: {
        approvalStatus: decision as ApprovalStatus,
        status: decision === "APPROVED" ? TicketStatus.IN_PROGRESS : TicketStatus.REJECTED,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to update approval." }, { status: 500 });
  }

  if (updateResult.count !== 1) {
    return NextResponse.json(
      { error: "Ticket is no longer awaiting approval." },
      { status: 409 },
    );
  }

  const updated = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, approvalStatus: true },
  });

  return NextResponse.json({ ticket: updated });
}
