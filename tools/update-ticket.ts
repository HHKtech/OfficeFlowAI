/**
 * tools/update-ticket.ts
 */
import { z } from "zod";
import { updateTicketStatus } from "@/services/ticket-service";

export const UpdateTicketInputSchema = z.object({
  ticketId: z.number().int().positive(),
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL", "RESOLVED", "REJECTED"]),
  approvalStatus: z
    .enum(["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"])
    .optional(),
});
export type UpdateTicketInput = z.infer<typeof UpdateTicketInputSchema>;

export async function updateTicketTool(raw: unknown) {
  const input = UpdateTicketInputSchema.parse(raw);
  return updateTicketStatus(input.ticketId, input.status, input.approvalStatus);
}
