import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { isDepartment } from "@/lib/departments";

const registrationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  department: z.string().refine(isDepartment, "Select a valid department."),
  role: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session.authenticated || !session.email) {
    return NextResponse.json({ error: "Please sign in before completing registration." }, { status: 401 });
  }

  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid registration details." }, { status: 400 });
  }

  const { name, department, role } = parsed.data;
  const existing = await prisma.employee.findUnique({ where: { email: session.email } });

  if (existing?.authUserId && existing.authUserId !== session.authUserId) {
    return NextResponse.json({ error: "An employee account already exists for this email." }, { status: 409 });
  }

  if (existing?.appRole === "ADMIN" && existing.authUserId === null) {
    return NextResponse.json({ error: "This email is reserved for an existing account." }, { status: 409 });
  }

  const employee = existing
    ? await prisma.employee.update({
        where: { id: existing.id },
        data: { name, department, role, authUserId: session.authUserId },
      })
    : await prisma.employee.create({
        data: {
          name,
          email: session.email,
          department,
          role,
          authUserId: session.authUserId,
          appRole: "EMPLOYEE",
        },
      });

  return NextResponse.json({ employee: { id: employee.id, appRole: employee.appRole } }, { status: existing ? 200 : 201 });
}