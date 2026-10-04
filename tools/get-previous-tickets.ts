/**
 * tools/get-previous-tickets.ts
 */
import { z } from "zod";
import { getPreviousTicketsByEmployee } from "@/services/ticket-service";

export const GetPreviousTicketsInputSchema = z.object({
  employeeId: z.number().int().positive(),
  category: z.enum(["IT", "FACILITIES", "SECURITY"]).optional(),
});
export type GetPreviousTicketsInput = z.infer<typeof GetPreviousTicketsInputSchema>;

export async function getPreviousTickets(raw: unknown) {
  const input = GetPreviousTicketsInputSchema.parse(raw);
  const tickets = await getPreviousTicketsByEmployee(input.employeeId, input.category);
  return { count: tickets.length, tickets };
}
