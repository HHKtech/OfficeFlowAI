/**
 * services/ticket-service.ts
 * Server-side only. Agents must never call Prisma directly.
 */
import prisma from "@/lib/db";
import type { TicketCategory, TicketPriority, TicketStatus, ApprovalStatus } from "@prisma/client";

export interface CreateTicketInput {
  employeeId: number;
  category: TicketCategory;
  subcategory?: string;
  title: string;
  description: string;
  priority: TicketPriority;
  assignedTeam: string;
  assignedTo?: string;
  requiresApproval?: boolean;
}

export async function createTicket(input: CreateTicketInput) {
  return prisma.ticket.create({
    data: {
      ...input,
      approvalStatus: input.requiresApproval ? "PENDING" : "NOT_REQUIRED",
      status: "OPEN",
    },
    select: {
      id: true,
      status: true,
      priority: true,
      assignedTeam: true,
      requiresApproval: true,
      approvalStatus: true,
      category: true,
      title: true,
    },
  });
}

export async function assignTicket(ticketId: number, assignedTo: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedTo, status: "ASSIGNED" },
    select: { id: true, assignedTo: true, status: true },
  });
}

export async function updateTicketStatus(
  ticketId: number,
  status: TicketStatus,
  approvalStatus?: ApprovalStatus,
  updates?: { priority?: TicketPriority; assignedTo?: string | null },
) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status,
      ...(approvalStatus ? { approvalStatus } : {}),
      ...(updates?.priority ? { priority: updates.priority } : {}),
      ...(updates && "assignedTo" in updates ? { assignedTo: updates.assignedTo } : {}),
    },
    select: { id: true, status: true, approvalStatus: true },
  });
}

export async function getTicketsForEmployee(where: { employeeId?: number; assignedTeam?: string }) {
  return prisma.ticket.findMany({
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
      employee: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getPreviousTicketsByEmployee(
  employeeId: number,
  category?: TicketCategory
) {
  return prisma.ticket.findMany({
    where: {
      employeeId,
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
    },
  });
}

export async function logAgentAction(input: {
  requestId: string;
  agent: string;
  action: string;
  tool: string;
  input: string;
  result: string;
  status: string;
}) {
  return prisma.agentLog.create({ data: input });
}
