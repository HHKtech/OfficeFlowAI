/**
 * tools/assign-ticket.ts
 */
import { z } from "zod";
import { assignTicket } from "@/services/ticket-service";

export const AssignTicketInputSchema = z.object({
  ticketId: z.number().int().positive(),
  assignedTo: z.string().min(1),
});
export type AssignTicketInput = z.infer<typeof AssignTicketInputSchema>;

export async function assignTicketTool(raw: unknown) {
  const input = AssignTicketInputSchema.parse(raw);
  return assignTicket(input.ticketId, input.assignedTo);
}
