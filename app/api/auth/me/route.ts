/**
 * app/api/auth/me/route.ts
 *
 * Returns the current authenticated user's Employee record.
 * Used by the frontend to determine who is logged in and their role.
 *
 * GET /api/auth/me
 *   → 401 if not authenticated
 *   → 403 if authenticated but no Employee record linked
 *   → 200 { employee: { id, name, email, department, role, appRole } }
 */

import { requireEmployee } from "@/lib/auth/session";

export async function GET() {
  const result = await requireEmployee();
  if (result instanceof Response) return result;

  return Response.json({
    employee: {
      id: result.employee.id,
      name: result.employee.name,
      email: result.employee.email,
      department: result.employee.department,
      role: result.employee.role,
      appRole: result.employee.appRole,
    },
  });
}
