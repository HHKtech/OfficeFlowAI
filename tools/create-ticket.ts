/**
 * tools/create-ticket.ts
 */
import { z } from "zod";
import { createTicket } from "@/services/ticket-service";

export const CreateTicketInputSchema = z.object({
  employeeId: z.number().int().positive(),
  category: z.enum(["IT", "FACILITIES", "SECURITY"]),
  subcategory: z.string().optional(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  assignedTeam: z.string().min(1),
  assignedTo: z.string().optional(),
  requiresApproval: z.boolean().optional().default(false),
});
export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

export async function createTicketTool(raw: unknown) {
  const input = CreateTicketInputSchema.parse(raw);
  const ticket = await createTicket(input);
  return {
    ticketId: ticket.id,
    status: ticket.status,
    priority: ticket.priority,
    assignedTeam: ticket.assignedTeam,
    requiresApproval: ticket.requiresApproval,
    approvalStatus: ticket.approvalStatus,
    category: ticket.category,
    title: ticket.title,
  };
}
