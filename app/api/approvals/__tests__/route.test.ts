jest.mock("@/lib/auth/session", () => ({
  requireAdminTeam: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    ticket: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { requireAdminTeam } from "@/lib/auth/session";
import prisma from "@/lib/db";
import { POST } from "../[id]/route";

const mockRequireAdminTeam = requireAdminTeam as jest.Mock;
const mockFindFirst = prisma.ticket.findFirst as jest.Mock;
const mockUpdateMany = prisma.ticket.updateMany as jest.Mock;
const mockFindUnique = prisma.ticket.findUnique as jest.Mock;

const securityAdmin = {
  authenticated: true,
  authUserId: "security-admin",
  email: "security.admin@gmail.com",
  name: "Security Admin",
  employee: { id: 1, name: "Security Admin", email: "security.admin@gmail.com", department: "Administration", role: "Security Operations Admin", appRole: "ADMIN", authUserId: "security-admin" },
  operationalTeam: "SECURITY",
};

const pendingTicket = {
  id: 42,
  requiresApproval: true,
  approvalStatus: "PENDING",
  status: "AWAITING_APPROVAL",
};

function request(decision: string) {
  return new Request("http://localhost/api/approvals/42", {
    method: "POST",
    body: JSON.stringify({ decision }),
    headers: { "content-type": "application/json" },
  });
}

async function approve(decision: "APPROVED" | "REJECTED" = "APPROVED") {
  return POST(request(decision), { params: Promise.resolve({ id: "42" }) });
}

describe("Security human approval API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdminTeam.mockResolvedValue(securityAdmin);
    mockFindFirst.mockResolvedValue(pendingTicket);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUnique.mockResolvedValue({ id: 42, status: "IN_PROGRESS", approvalStatus: "APPROVED" });
  });

  it("allows Security Admin to approve a pending Security ticket", async () => {
    const response = await approve();
    expect(response.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ approvalStatus: "PENDING", status: "AWAITING_APPROVAL" }),
      data: { approvalStatus: "APPROVED", status: "IN_PROGRESS" },
    }));
  });

  it.each(["IT", "FACILITIES"])("rejects %s Admin approval attempts", async (team) => {
    mockRequireAdminTeam.mockResolvedValue({ ...securityAdmin, operationalTeam: team });
    const response = await approve();
    expect(response.status).toBe(403);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("rejects employee approval attempts", async () => {
    mockRequireAdminTeam.mockResolvedValue({ ...securityAdmin, employee: { ...securityAdmin.employee, appRole: "EMPLOYEE" }, operationalTeam: null });
    const response = await approve();
    expect(response.status).toBe(403);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("rejects duplicate approval after the ticket is no longer pending", async () => {
    mockFindFirst.mockResolvedValue({ ...pendingTicket, approvalStatus: "APPROVED", status: "IN_PROGRESS" });
    const response = await approve();
    expect(response.status).toBe(409);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects non-approval tickets", async () => {
    mockFindFirst.mockResolvedValue({ ...pendingTicket, requiresApproval: false, approvalStatus: "NOT_REQUIRED", status: "OPEN" });
    const response = await approve();
    expect(response.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a stale concurrent approval when the conditional update affects no rows", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const response = await approve("REJECTED");
    expect(response.status).toBe(409);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
