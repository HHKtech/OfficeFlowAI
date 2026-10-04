/**
 * services/employee-service.ts
 * Server-side only. Agents must never call Prisma directly.
 */
import prisma from "@/lib/db";

export async function getEmployeeById(id: number) {
  return prisma.employee.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, department: true, role: true, appRole: true },
  });
}

export async function getEmployeeByEmail(email: string) {
  return prisma.employee.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, department: true, role: true, appRole: true },
  });
}

