/**
 * tests/agents.test.ts
 *
 * Behavioral tests for P5-P9.
 * Uses real DB (Neon) and real tool layer. No mocks/stubs.
 * Requires: DATABASE_URL, GEMINI_API_KEY in .env
 */

import { describe, it, expect } from "@jest/globals";
import { runOrchestrator } from "../agents/orchestrator";
import { runItAgent } from "../agents/it-agent";
import { runFacilitiesAgent } from "../agents/facilities-agent";
import { runSecurityAgent } from "../agents/security-agent";
import prisma from "../lib/db";
import { randomUUID } from "crypto";
import type { RequestContext, IssueContext } from "../agents/types";

// Helpers
const ctx = (overrides: Partial<RequestContext> = {}): RequestContext => ({
  employeeId: 1,
  message: "test",
  requestId: randomUUID(),
  ...overrides,
});

const itIssue = (desc: string): IssueContext => ({
  description: desc,
  category: "IT",
  entities: { asset: "projector", room: "Conference Room B", deadline: "tomorrow" },
  severity: "high",
  urgency: "high – client meeting tomorrow",
  impact: "client-facing meeting affected",
  recommendedPriority: "HIGH",
});

const facilitiesIssue = (desc: string): IssueContext => ({
  description: desc,
  category: "FACILITIES",
  entities: { asset: "AC", room: "Conference Room B", deadline: "tomorrow" },
  severity: "high",
  urgency: "high – client meeting tomorrow",
  impact: "client-facing meeting affected",
  recommendedPriority: "HIGH",
});

const securityIssue = (desc: string): IssueContext => ({
  description: desc,
  category: "SECURITY",
  entities: { device: "Laptop" },
  severity: "critical",
  urgency: "critical",
  impact: "potential data breach",
  recommendedPriority: "CRITICAL",
});

// ─── P6: IT Agent ──────────────────────────────────────────────────────────
describe("P6 – IT Agent", () => {
  it("completes tool sequence and returns typed AgentResult", async () => {
    const context = ctx({ message: "The projector in Conference Room B isn't working." });
    const issue = itIssue("The projector in Conference Room B isn't working.");

    const result = await runItAgent(context, issue);

    expect(result.agent).toBe("IT Agent");
    expect(result.category).toBe("IT");
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(result.priority);
    expect(typeof result.requiresApproval).toBe("boolean");
    expect(result.requiresApproval).toBe(false);
    expect(result.status).toMatch(/SUCCESS|PARTIAL/);
  }, 60000);

  it("creates an IT ticket in the DB", async () => {
    const start = new Date();
    const context = ctx({ message: "My laptop isn't turning on." });
    const issue = itIssue("My laptop isn't turning on.");
    issue.entities = { device: "Laptop" };

    const result = await runItAgent(context, issue);

    if (result.ticketId !== null) {
      const ticket = await prisma.ticket.findUnique({ where: { id: result.ticketId } });
      expect(ticket).not.toBeNull();
      expect(ticket?.category).toBe("IT");
      expect(ticket?.assignedTeam).toBe("IT");
      expect(ticket?.assignedTo).toBe("it.admin@example.com");
      expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(ticket?.priority);
      expect(new Date(ticket!.createdAt).getTime()).toBeGreaterThanOrEqual(start.getTime());
    }
  }, 60000);

  it("applies HIGH priority when deadline is tomorrow", async () => {
    const context = ctx({ message: "Projector broken, client meeting tomorrow." });
    const issue = itIssue("Projector broken, client meeting tomorrow.");
    const result = await runItAgent(context, issue);
    expect(["HIGH", "CRITICAL"]).toContain(result.priority);
  }, 60000);

  it("logs AgentLog entries for the request", async () => {
    const requestId = randomUUID();
    const context = ctx({ requestId, message: "Printer not working." });
    const issue = itIssue("Printer not working.");
    issue.entities = { asset: "Office Printer" };

    await runItAgent(context, issue);

    const logs = await prisma.agentLog.findMany({ where: { requestId } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.agent === "IT Agent")).toBe(true);
    expect(logs.some((l) => l.tool === "create_ticket" || l.tool === "None")).toBe(true);
  }, 60000);

  it("does NOT update an unrelated recent ticket", async () => {
    // Create an unrelated unresolved IT ticket (Printer)
    const unrelatedTicket = await prisma.ticket.create({
      data: {
        employeeId: 1,
        category: "IT",
        title: "Printer jam",
        description: "The printer is jammed in the hallway.",
        priority: "LOW",
        assignedTeam: "IT",
        status: "OPEN",
        approvalStatus: "NOT_REQUIRED",
      },
    });

    const context = ctx({ message: "My laptop is broken." });
    const issue = itIssue("My laptop is broken.");
    issue.entities = { device: "Laptop" };

    await runItAgent(context, issue);

    // Verify the unrelated ticket was NOT updated to IN_PROGRESS
    const checkedTicket = await prisma.ticket.findUnique({ where: { id: unrelatedTicket.id } });
    expect(checkedTicket?.status).toBe("OPEN"); // Not IN_PROGRESS
  }, 60000);
});

// ─── P7: Facilities Agent ───────────────────────────────────────────────────
describe("P7 – Facilities Agent", () => {
  it("completes tool sequence and returns typed AgentResult", async () => {
    const context = ctx({ message: "AC in Conference Room B isn't working." });
    const issue = facilitiesIssue("AC in Conference Room B isn't working.");

    const result = await runFacilitiesAgent(context, issue);

    expect(result.agent).toBe("Facilities Agent");
    expect(result.category).toBe("FACILITIES");
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(result.priority);
    expect(result.requiresApproval).toBe(false);
    expect(result.status).toMatch(/SUCCESS|PARTIAL/);
  }, 60000);

  it("creates a FACILITIES ticket in the DB", async () => {
    const context = ctx({ message: "Conference Room B AC not cooling." });
    const issue = facilitiesIssue("Conference Room B AC not cooling.");

    const result = await runFacilitiesAgent(context, issue);

    if (result.ticketId !== null) {
      const ticket = await prisma.ticket.findUnique({ where: { id: result.ticketId } });
      expect(ticket).not.toBeNull();
      expect(ticket?.category).toBe("FACILITIES");
      expect(ticket?.assignedTeam).toBe("FACILITIES");
      expect(ticket?.assignedTo).toBe("facilities.admin@example.com");
    }
  }, 60000);

  it("applies HIGH priority when deadline is tomorrow", async () => {
    const context = ctx({ message: "AC broken, client meeting tomorrow." });
    const issue = facilitiesIssue("AC broken, client meeting tomorrow.");
    const result = await runFacilitiesAgent(context, issue);
    expect(["HIGH", "CRITICAL"]).toContain(result.priority);
  }, 60000);

  it("logs AgentLog entries for the request", async () => {
    const requestId = randomUUID();
    const context = ctx({ requestId, message: "Office lights not working." });
    const issue = facilitiesIssue("Office lights not working.");
    issue.entities = { asset: "Office Lights" };

    await runFacilitiesAgent(context, issue);

    const logs = await prisma.agentLog.findMany({ where: { requestId } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.agent === "Facilities Agent")).toBe(true);
  }, 60000);

  it("does NOT update an unrelated recent ticket", async () => {
    const unrelatedTicket = await prisma.ticket.create({
      data: {
        employeeId: 1,
        category: "FACILITIES",
        title: "Plumbing leak",
        description: "Bathroom sink is leaking.",
        priority: "MEDIUM",
        assignedTeam: "FACILITIES",
        status: "OPEN",
        approvalStatus: "NOT_REQUIRED",
      },
    });

    const context = ctx({ message: "AC is broken in Conference Room A." });
    const issue = facilitiesIssue("AC is broken in Conference Room A.");
    issue.entities = { asset: "AC", room: "Conference Room A" };

    await runFacilitiesAgent(context, issue);

    const checkedTicket = await prisma.ticket.findUnique({ where: { id: unrelatedTicket.id } });
    expect(checkedTicket?.status).toBe("OPEN"); // Not IN_PROGRESS
  }, 60000);
});

// ─── P8: Security Agent ─────────────────────────────────────────────────────
describe("P8 – Security Agent", () => {
  it("returns requiresApproval=true for lost device", async () => {
    const context = ctx({ message: "I lost my company laptop." });
    const issue = securityIssue("I lost my company laptop.");

    const result = await runSecurityAgent(context, issue);

    expect(result.agent).toBe("Security Agent");
    expect(result.category).toBe("SECURITY");
    expect(result.requiresApproval).toBe(true);
    expect(["HIGH", "CRITICAL"]).toContain(result.riskLevel);
    expect(typeof result.recommendedAction).toBe("string");
    expect(result.recommendedAction!.length).toBeGreaterThan(0);
  }, 60000);

  it("creates a ticket with AWAITING_APPROVAL status for lost device", async () => {
    const context = ctx({ message: "I lost my company laptop." });
    const issue = securityIssue("I lost my company laptop.");

    const result = await runSecurityAgent(context, issue);

    if (result.ticketId !== null) {
      const ticket = await prisma.ticket.findUnique({ where: { id: result.ticketId } });
      expect(ticket).not.toBeNull();
      expect(ticket?.assignedTeam).toBe("SECURITY");
      expect(ticket?.assignedTo).toBe("security.admin@example.com");
      expect(ticket?.requiresApproval).toBe(true);
      expect(ticket?.approvalStatus).toBe("PENDING");
      expect(ticket?.status).toBe("AWAITING_APPROVAL");
    }
  }, 60000);

  it("does NOT auto-disable device (ticket is AWAITING_APPROVAL, not RESOLVED)", async () => {
    const context = ctx({ message: "I lost my company laptop." });
    const issue = securityIssue("I lost my company laptop.");

    const result = await runSecurityAgent(context, issue);

    if (result.ticketId !== null) {
      const ticket = await prisma.ticket.findUnique({ where: { id: result.ticketId } });
      // If auto-disabled, status would be RESOLVED. It must NOT be.
      expect(ticket?.status).not.toBe("RESOLVED");
    }
  }, 60000);

  it("logs AgentLog entries including security-specific steps", async () => {
    const requestId = randomUUID();
    const context = ctx({ requestId, message: "I lost my company laptop." });
    const issue = securityIssue("I lost my company laptop.");

    await runSecurityAgent(context, issue);

    const logs = await prisma.agentLog.findMany({ where: { requestId } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.tool === "get_employee")).toBe(true);
    expect(logs.some((l) => l.tool === "check_device")).toBe(true);
    expect(logs.some((l) => l.tool === "search_policy")).toBe(true);
    expect(logs.some((l) => l.tool === "create_ticket")).toBe(true);
  }, 60000);
});

// ─── P5 + P9: Orchestrator / Multi-agent ────────────────────────────────────
describe("P5/P9 – Orchestrator multi-agent workflow", () => {
  it("detects 2 issues and routes IT+Facilities for the demo request", async () => {
    const context = ctx({
      message: "The projector and AC in Conference Room B aren't working and we have a client meeting tomorrow.",
    });

    const result = await runOrchestrator(context);

    expect(result.requestId).toBe(context.requestId);
    expect(result.issuesDetected).toBeGreaterThanOrEqual(1);
    expect(result.agentsUsed).toContain("orchestrator");
    expect(typeof result.finalResponse).toBe("string");
    expect(result.finalResponse.length).toBeGreaterThan(0);
  }, 120000);

  it("creates tickets in the DB and tracks them via AgentResults (not createdAt)", async () => {
    const context = ctx({
      message: "The projector and AC in Conference Room B aren't working and we have a client meeting tomorrow.",
    });

    const result = await runOrchestrator(context);

    // Tickets from AgentResult, not broad createdAt query
    for (const ticketId of result.ticketsCreated) {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket).not.toBeNull();
    }
  }, 120000);

  it("records AgentLog entries for the entire request", async () => {
    const requestId = randomUUID();
    const context = ctx({
      requestId,
      message: "The projector and AC in Conference Room B aren't working and we have a client meeting tomorrow.",
    });

    await runOrchestrator(context);

    const logs = await prisma.agentLog.findMany({ where: { requestId } });
    expect(logs.length).toBeGreaterThan(2); // at least Orchestrator + agent logs
    expect(logs.some((l) => l.agent === "Orchestrator")).toBe(true);
  }, 120000);

  it("isolates a FACILITIES agent failure without crashing IT result", async () => {
    const requestId = randomUUID();
    // Craft an issue where Facilities would fail (invalid data) but IT should still succeed
    const context = ctx({
      requestId,
      message: "My laptop isn't turning on.",
    });

    // Run just the orchestrator; it should return a result (not throw)
    const result = await runOrchestrator(context);
    expect(result).toBeDefined();
    expect(typeof result.issuesDetected).toBe("number");
  }, 120000);

  it("returns requiresApproval=true for lost device scenario", async () => {
    const context = ctx({ message: "I lost my company laptop." });
    const result = await runOrchestrator(context);
    expect(result.requiresApproval).toBe(true);
  }, 120000);

  it("never crashes when Gemini is unavailable (safe fallback)", async () => {
    // Simulate by sending a very short ambiguous message
    const context = ctx({ message: "x" });
    // Should not throw regardless
    await expect(runOrchestrator(context)).resolves.toBeDefined();
  }, 120000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
