/**
 * app/api/agent-logs/[requestId]/route.ts
 *
 * GET /api/agent-logs/[requestId] — Returns agent execution logs for a request.
 *
 * SECURITY:
 * - ADMIN: can view logs for any requestId.
 * - EMPLOYEE: currently not authorized to view agent logs (internal/audit data).
 *   Returns 403.
 *
 * Agent logs contain internal execution details that should not be exposed
 * to regular employees. Only admins may audit agent behavior.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import prisma from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  // Agent logs are admin-only — internal audit data
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const { requestId } = await params;

  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json({ error: "Invalid requestId." }, { status: 400 });
  }

  const logs = await prisma.agentLog.findMany({
    where: { requestId },
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      requestId: true,
      agent: true,
      action: true,
      tool: true,
      input: true,
      result: true,
      status: true,
      timestamp: true,
    },
  });

  return NextResponse.json({ logs });
}
