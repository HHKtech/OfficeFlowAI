jest.mock("@/lib/auth/session", () => ({
  requireAdminTeam: jest.fn(),
}));

jest.mock("@/services/ticket-service", () => ({
  getTicketsForEmployee: jest.fn(),
}));

import { requireAdminTeam } from "@/lib/auth/session";
import { getTicketsForEmployee } from "@/services/ticket-service";
import { GET } from "../export/route";

const mockRequireAdminTeam = requireAdminTeam as jest.Mock;
const mockGetTicketsForEmployee = getTicketsForEmployee as jest.Mock;

const admin = (operationalTeam: "IT" | "FACILITIES" | "SECURITY") => ({
  authenticated: true,
  authUserId: `${operationalTeam.toLowerCase()}-admin`,
  email: `${operationalTeam.toLowerCase()}.admin@gmail.com`,
  name: `${operationalTeam} Admin`,
  employee: { id: 1, name: `${operationalTeam} Admin`, email: "admin@example.com", department: "Administration", role: "Admin", appRole: "ADMIN", authUserId: "admin" },
  operationalTeam,
});

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Laptop request",
    category: "IT",
    priority: "HIGH",
    status: "OPEN",
    assignedTeam: "IT",
    assignedTo: null,
    approvalStatus: "NOT_REQUIRED",
    createdAt: new Date("2026-10-05T10:00:00.000Z"),
    updatedAt: new Date("2026-10-05T11:00:00.000Z"),
    employee: { name: "Alice Smith" },
    ...overrides,
  };
}

describe("GET /api/tickets/export", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTicketsForEmployee.mockResolvedValue([]);
  });

  it.each(["IT", "FACILITIES", "SECURITY"] as const)("filters exports to the %s team", async (team) => {
    mockRequireAdminTeam.mockResolvedValue(admin(team));
    await GET();
    expect(mockGetTicketsForEmployee).toHaveBeenCalledWith({ assignedTeam: team });
  });

  it("rejects employee access", async () => {
    mockRequireAdminTeam.mockResolvedValue(Response.json({ error: "Forbidden" }, { status: 403 }));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mockGetTicketsForEmployee).not.toHaveBeenCalled();
  });

  it("escapes commas, quotes, and newlines in CSV fields", async () => {
    mockRequireAdminTeam.mockResolvedValue(admin("IT"));
    mockGetTicketsForEmployee.mockResolvedValue([ticket({
      title: 'Replace, "broken" screen\nsoon',
      employee: { name: "Alice\nSmith" },
      assignedTo: "Tech, One",
    })]);

    const response = await GET();
    const csv = await response.text();
    expect(csv).toContain('"Replace, ""broken"" screen\nsoon"');
    expect(csv).toContain('"Alice\nSmith"');
    expect(csv).toContain('"Tech, One"');
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("officeflow-tickets.csv");
  });
});