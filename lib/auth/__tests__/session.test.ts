/**
 * lib/auth/__tests__/session.test.ts
 *
 * Unit tests for the authentication and authorization helpers.
 *
 * These tests mock @/lib/auth/server and @/lib/db to verify:
 * - Unauthenticated requests are rejected with 401
 * - Authenticated employees can perform employee-level operations
 * - Authenticated employees cannot perform admin-only operations (403)
 * - Authenticated admins can perform admin operations
 * - Authenticated users with no matching Employee record are rejected (403)
 * - Authentication failures do not expose sensitive details
 */

// Mock the Neon Auth server module
jest.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: jest.fn(),
  },
}));

// Mock Prisma db module
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    employee: {
      findUnique: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth/server";
import prisma from "@/lib/db";
import {
  getCurrentSession,
  requireAuthenticatedUser,
  requireEmployee,
  requireAdmin,
} from "../session";

const mockGetSession = auth.getSession as jest.Mock;
const mockFindUnique = (prisma.employee.findUnique as jest.Mock);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockUnauthenticated() {
  mockGetSession.mockResolvedValue({ data: null, error: null });
}

function mockAuthenticated(userId = "auth-user-123", email = "alice@example.com", name = "Alice") {
  mockGetSession.mockResolvedValue({
    data: { user: { id: userId, email, name } },
    error: null,
  });
}

function mockEmployee(overrides = {}) {
  mockFindUnique.mockResolvedValue({
    id: 1,
    name: "Alice Smith",
    email: "alice@example.com",
    department: "Engineering",
    role: "Developer",
    appRole: "EMPLOYEE",
    authUserId: "auth-user-123",
    ...overrides,
  });
}

function mockNoEmployee() {
  mockFindUnique.mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// getCurrentSession
// ---------------------------------------------------------------------------

describe("getCurrentSession", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns { authenticated: false } when there is no session", async () => {
    mockUnauthenticated();
    const result = await getCurrentSession();
    expect(result.authenticated).toBe(false);
  });

  it("returns { authenticated: false } when auth.getSession throws", async () => {
    mockGetSession.mockRejectedValue(new Error("Internal auth error"));
    const result = await getCurrentSession();
    // Must NOT expose the internal error — just return unauthenticated
    expect(result.authenticated).toBe(false);
  });

  it("returns authenticated session with user fields", async () => {
    mockAuthenticated("uid-42", "bob@example.com", "Bob");
    const result = await getCurrentSession();
    expect(result.authenticated).toBe(true);
    if (result.authenticated) {
      expect(result.authUserId).toBe("uid-42");
      expect(result.email).toBe("bob@example.com");
      expect(result.name).toBe("Bob");
    }
  });

  it("does not include session token or secrets in the result", async () => {
    mockAuthenticated();
    const result = await getCurrentSession();
    // Verify no token/secret fields leak through
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("secret");
    expect(result).not.toHaveProperty("sessionToken");
    expect(result).not.toHaveProperty("accessToken");
  });
});

// ---------------------------------------------------------------------------
// requireAuthenticatedUser
// ---------------------------------------------------------------------------

describe("requireAuthenticatedUser", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 Response for unauthenticated request", async () => {
    mockUnauthenticated();
    const result = await requireAuthenticatedUser();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns the session for authenticated request", async () => {
    mockAuthenticated("uid-99");
    const result = await requireAuthenticatedUser();
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.authenticated).toBe(true);
      expect(result.authUserId).toBe("uid-99");
    }
  });

  it("401 response body does not expose auth implementation details", async () => {
    mockUnauthenticated();
    const result = await requireAuthenticatedUser();
    const body = await (result as Response).json();
    // Should only say "Unauthorized" — no stack traces, no token info
    expect(body.error).toBe("Unauthorized");
    expect(JSON.stringify(body)).not.toContain("NEON_AUTH");
    expect(JSON.stringify(body)).not.toContain("cookie");
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});

// ---------------------------------------------------------------------------
// requireEmployee
// ---------------------------------------------------------------------------

describe("requireEmployee", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 for unauthenticated request", async () => {
    mockUnauthenticated();
    const result = await requireEmployee();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns 403 when authenticated user has no Employee record", async () => {
    mockAuthenticated("uid-no-employee");
    mockNoEmployee();
    const result = await requireEmployee();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("returns AuthorizedEmployee for valid authenticated employee", async () => {
    mockAuthenticated("auth-user-123");
    mockEmployee();
    const result = await requireEmployee();
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.authenticated).toBe(true);
      expect(result.employee.id).toBe(1);
      expect(result.employee.appRole).toBe("EMPLOYEE");
    }
  });

  it("looks up employee by authUserId from session — NOT from any client input", async () => {
    mockAuthenticated("trusted-auth-id");
    mockEmployee({ authUserId: "trusted-auth-id" });
    await requireEmployee();
    // Verify Prisma was called with the session authUserId, not some other ID
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authUserId: "trusted-auth-id" },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

describe("requireAdmin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 for unauthenticated request", async () => {
    mockUnauthenticated();
    const result = await requireAdmin();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns 403 for authenticated employee (non-admin)", async () => {
    mockAuthenticated("auth-user-123");
    mockEmployee({ appRole: "EMPLOYEE" });
    const result = await requireAdmin();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("returns 403 when authenticated user has no Employee record", async () => {
    mockAuthenticated("uid-no-employee");
    mockNoEmployee();
    const result = await requireAdmin();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("returns AuthorizedEmployee for authenticated ADMIN", async () => {
    mockAuthenticated("admin-auth-id");
    mockEmployee({ appRole: "ADMIN", authUserId: "admin-auth-id" });
    const result = await requireAdmin();
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.employee.appRole).toBe("ADMIN");
    }
  });

  it("403 error for non-admin does not expose role values beyond message", async () => {
    mockAuthenticated("auth-user-123");
    mockEmployee({ appRole: "EMPLOYEE" });
    const result = await requireAdmin();
    const body = await (result as Response).json();
    expect(body.error).toContain("Admin");
    expect(body).not.toHaveProperty("authUserId");
    expect(body).not.toHaveProperty("sessionToken");
  });
});

// ---------------------------------------------------------------------------
// Security: client-supplied employeeId must be ignored
// ---------------------------------------------------------------------------

describe("Client-supplied employeeId must be ignored", () => {
  beforeEach(() => jest.clearAllMocks());

  it("never calls employee lookup with a spoofed employeeId", async () => {
    // Simulate attacker who is authenticated as user-A but tries to
    // access employee records as user-B via requireEmployee
    mockAuthenticated("user-A-auth-id");
    mockEmployee({ authUserId: "user-A-auth-id", id: 1 });

    await requireEmployee();

    // Prisma must ONLY be called with the session authUserId
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authUserId: "user-A-auth-id" },
      })
    );
    // Should NOT be called with any numeric ID (which would be client-supplied)
    const callArgs = mockFindUnique.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty("id");
  });
});
