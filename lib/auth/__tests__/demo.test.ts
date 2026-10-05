jest.mock("@/lib/auth/server", () => ({
  auth: { getSession: jest.fn() },
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    employee: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("next/headers", () => ({ cookies: jest.fn() }));

import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { POST as demoLogin } from "@/app/api/auth/demo/route";
import { createDemoSession, verifyDemoAdminCredentials } from "../demo";
import { getCurrentSession, requireAdmin } from "../session";

const mockCookies = cookies as jest.Mock;
const mockFindFirst = prisma.employee.findFirst as jest.Mock;

const accounts = [
  ["it.admin@gmail.com", "DEMO_IT_ADMIN_PASSWORD"],
  ["facilities.admin@gmail.com", "DEMO_FACILITIES_ADMIN_PASSWORD"],
  ["security.admin@gmail.com", "DEMO_SECURITY_ADMIN_PASSWORD"],
] as const;

describe("demo admin authentication", () => {
  beforeEach(() => {
    process.env.NEON_AUTH_COOKIE_SECRET = "test-cookie-secret";
    for (const [, variable] of accounts) process.env[variable] = `${variable}-value`;
    mockCookies.mockReturnValue({ get: () => undefined });
    mockFindFirst.mockReset();
  });

  afterEach(() => {
    for (const [, variable] of accounts) delete process.env[variable];
    delete process.env.NEON_AUTH_COOKIE_SECRET;
  });

  it.each(accounts)("accepts a valid %s demo admin login", async (email, variable) => {
    const response = await demoLogin(new Request("http://localhost/api/auth/demo", {
      method: "POST",
      body: JSON.stringify({ email, password: `${variable}-value` }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects an invalid demo admin password", async () => {
    const response = await demoLogin(new Request("http://localhost/api/auth/demo", {
      method: "POST",
      body: JSON.stringify({ email: accounts[0][0], password: "wrong-password" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid credentials." });
  });

  it("resolves a demo session to an ADMIN employee from Prisma", async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: createDemoSession(accounts[0][0]) }) });
    mockFindFirst.mockResolvedValue({
      id: 7,
      name: "IT Admin",
      email: accounts[0][0],
      department: "Administration",
      role: "IT Operations Admin",
      appRole: "ADMIN",
      authUserId: null,
    });

    const session = await getCurrentSession();
    expect(session).toEqual(expect.objectContaining({ authenticated: true, email: accounts[0][0] }));
    const result = await requireAdmin();
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) expect(result.employee.appRole).toBe("ADMIN");
    expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: accounts[0][0], appRole: "ADMIN" },
    }));
  });

  it("does not authenticate an employee by changing client-side role values", async () => {
    expect(verifyDemoAdminCredentials("ali.khan@example.com", "anything")).toBe(false);
  });
});