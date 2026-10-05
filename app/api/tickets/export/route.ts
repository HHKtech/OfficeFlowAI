import { requireAdminTeam } from "@/lib/auth/session";
import { getTicketsForEmployee } from "@/services/ticket-service";

const CSV_HEADERS = [
  "Ticket ID",
  "Title",
  "Category",
  "Priority",
  "Status",
  "Employee",
  "Assigned Team",
  "Assigned To",
  "Approval Status",
  "Created At",
  "Updated At",
];

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET() {
  const authResult = await requireAdminTeam();
  if (authResult instanceof Response) return authResult;

  try {
    const tickets = await getTicketsForEmployee({
      assignedTeam: authResult.operationalTeam!,
    });
    const rows = tickets.map((ticket) => [
      ticket.id,
      ticket.title,
      ticket.category,
      ticket.priority,
      ticket.status,
      ticket.employee.name,
      ticket.assignedTeam,
      ticket.assignedTo,
      ticket.approvalStatus,
      ticket.createdAt.toISOString(),
      ticket.updatedAt.toISOString(),
    ]);
    const csv = [CSV_HEADERS, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    return new Response(`\uFEFF${csv}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="officeflow-tickets.csv"',
      },
    });
  } catch {
    return Response.json({ error: "Unable to export tickets." }, { status: 500 });
  }
}