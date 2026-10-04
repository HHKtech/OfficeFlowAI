/**
 * tools/get-employee.ts
 */
import { z } from "zod";
import { getEmployeeById, getEmployeeByEmail } from "@/services/employee-service";

export const GetEmployeeInputSchema = z.union([
  z.object({ employeeId: z.number().int().positive() }),
  z.object({ email: z.string().email() }),
]);
export type GetEmployeeInput = z.infer<typeof GetEmployeeInputSchema>;

export async function getEmployee(raw: unknown) {
  const input = GetEmployeeInputSchema.parse(raw);
  const employee =
    "employeeId" in input
      ? await getEmployeeById(input.employeeId)
      : await getEmployeeByEmail(input.email);
  return employee
    ? { found: true, employee }
    : { found: false, message: "Employee not found." };
}
