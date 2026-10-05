import { NextResponse } from "next/server";
import { requireAdminTeam } from "@/lib/auth/session";
import prisma from "@/lib/db";

export async function GET() {
  const authResult = await requireAdminTeam();
  if (authResult instanceof Response) return authResult;
  if (authResult.operationalTeam !== "SECURITY") {
    return NextResponse.json(
      { error: "Forbidden: Security Admin approval queue required." },
      { status: 403 },
    );
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        category: "SECURITY",
        assignedTeam: "SECURITY",
        requiresApproval: true,
        approvalStatus: "PENDING",
        status: "AWAITING_APPROVAL",
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        approvalStatus: true,
        status: true,
        createdAt: true,
        employee: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      approvals: tickets.map((ticket) => {
        const policyMarker = "\n\nPolicy reference:";
        const recommendationMarker = "\n\nRecommended action:";
        const requestEnd = ticket.description.indexOf(recommendationMarker);
        const employeeRequest = ticket.description.slice(
          0,
          requestEnd >= 0 ? requestEnd : ticket.description.indexOf(policyMarker) >= 0 ? ticket.description.indexOf(policyMarker) : undefined,
        );
        const recommendationStart = ticket.description.indexOf(recommendationMarker);
        const recommendation = recommendationStart >= 0
          ? ticket.description.slice(recommendationStart + recommendationMarker.length).split(policyMarker)[0].trim()
          : "Review the security incident and decide whether the requested action may proceed.";

        return {
          id: ticket.id,
          title: ticket.title,
          priority: ticket.priority,
          risk: ticket.priority,
          employeeRequest: employeeRequest.trim(),
          recommendation: recommendation.slice(0, 240),
          employee: ticket.employee,
          createdAt: ticket.createdAt,
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Unable to load approval queue." }, { status: 500 });
  }
}