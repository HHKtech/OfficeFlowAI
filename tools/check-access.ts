/**
 * tools/check-access.ts
 * Checks employee access / security information.
 */
import { z } from "zod";
import { getEmployeeById } from "@/services/employee-service";

export const CheckAccessInputSchema = z.object({
  employeeId: z.number().int().positive(),
});
export type CheckAccessInput = z.infer<typeof CheckAccessInputSchema>;

export async function checkEmployeeAccess(raw: unknown) {
  const input = CheckAccessInputSchema.parse(raw);
  const employee = await getEmployeeById(input.employeeId);
  if (!employee) {
    return { found: false, message: `Employee ${input.employeeId} not found.` };
  }
  return {
    found: true,
    employee,
    requiresApproval: true, // Security actions always require approval
    note: "All security and access changes require manager approval per company policy.",
  };
}
