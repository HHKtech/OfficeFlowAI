/**
 * tools/registry.ts
 *
 * Central tool registry for OfficeFlow AI.
 *
 * SECURITY CONTRACT:
 * - Only tools registered here can be called by agents.
 * - Unknown tool names are rejected with an error.
 * - No eval(), no arbitrary code execution, no raw SQL.
 * - The LLM may NEVER directly access Prisma or the database.
 *
 * To add a tool:
 *  1. Create the tool file in tools/
 *  2. Add its entry to TOOL_REGISTRY below
 *  3. Add its GeminiToolDefinition to TOOL_DEFINITIONS
 */

import type { GeminiToolDefinition } from "@/lib/gemini";

import { checkDevice } from "./check-device";
import { checkAsset } from "./check-asset";
import { checkEmployeeAccess } from "./check-access";
import { searchPolicy } from "./search-policy";
import { getEmployee } from "./get-employee";
import { getPreviousTickets } from "./get-previous-tickets";
import { createTicketTool } from "./create-ticket";
import { assignTicketTool } from "./assign-ticket";
import { updateTicketTool } from "./update-ticket";
import { logAgentActionTool } from "./log-agent-action";

// ---------------------------------------------------------------------------
// Tool executor map
// ---------------------------------------------------------------------------

type ToolFn = (args: Record<string, unknown>) => Promise<unknown>;

const TOOL_REGISTRY: Record<string, ToolFn> = {
  check_device: checkDevice,
  check_asset: checkAsset,
  check_employee_access: checkEmployeeAccess,
  search_policy: searchPolicy,
  get_employee: getEmployee,
  get_previous_tickets: getPreviousTickets,
  create_ticket: createTicketTool,
  assign_ticket: assignTicketTool,
  update_ticket: updateTicketTool,
  log_agent_action: logAgentActionTool,
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;

/**
 * Execute a registered tool by name. Rejects any unknown tool name.
 * This is the ONLY entry point agents use to call tools.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const fn = Object.prototype.hasOwnProperty.call(TOOL_REGISTRY, name)
    ? (TOOL_REGISTRY as Record<string, ToolFn>)[name]
    : undefined;

  if (!fn) {
    throw new Error(
      `Unknown tool: "${name}". Only registered tools may be called. Registered: ${Object.keys(TOOL_REGISTRY).join(", ")}`
    );
  }
  return fn(args);
}

/**
 * Returns the list of registered tool names.
 */
export function getRegisteredToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

// ---------------------------------------------------------------------------
// Gemini tool definitions (passed to the LLM so it knows what to call)
// ---------------------------------------------------------------------------

export const TOOL_DEFINITIONS: GeminiToolDefinition[] = [
  {
    name: "check_device",
    description: "Check a device assigned to an employee by type. Returns device status and details.",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "number", description: "The employee's ID." },
        deviceType: { type: "string", description: "Device type e.g. 'Laptop', 'Monitor'." },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "check_asset",
    description: "Check office assets by name or location (e.g. projector, AC, printer).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Asset name or partial name." },
        location: { type: "string", description: "Location e.g. 'Conference Room B'." },
      },
    },
  },
  {
    name: "check_employee_access",
    description: "Check an employee's access level and whether a security action requires approval.",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "number", description: "The employee's ID." },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "search_policy",
    description: "Search company policies for guidance on handling an issue.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Topic or keywords to search." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_employee",
    description: "Retrieve employee information by ID or email.",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "number", description: "Employee ID." },
        email: { type: "string", description: "Employee email address." },
      },
    },
  },
  {
    name: "get_previous_tickets",
    description: "Retrieve previous support tickets for an employee, optionally filtered by category.",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "number", description: "Employee ID." },
        category: {
          type: "string",
          description: "Optional ticket category filter.",
          enum: ["IT", "FACILITIES", "SECURITY"],
        },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "create_ticket",
    description: "Create a new support ticket.",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "number", description: "Employee ID." },
        category: { type: "string", description: "Ticket category.", enum: ["IT", "FACILITIES", "SECURITY"] },
        subcategory: { type: "string", description: "Optional subcategory." },
        title: { type: "string", description: "Short ticket title." },
        description: { type: "string", description: "Detailed description of the issue." },
        priority: { type: "string", description: "Ticket priority.", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        assignedTeam: { type: "string", description: "Team to handle this ticket (IT, FACILITIES, SECURITY)." },
        assignedTo: { type: "string", description: "Optional specific person." },
        requiresApproval: { type: "boolean", description: "Whether managerial approval is required." },
      },
      required: ["employeeId", "category", "title", "description", "priority", "assignedTeam"],
    },
  },
  {
    name: "assign_ticket",
    description: "Assign an existing ticket to a specific team member.",
    parameters: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID." },
        assignedTo: { type: "string", description: "Name or identifier of the person to assign." },
      },
      required: ["ticketId", "assignedTo"],
    },
  },
  {
    name: "update_ticket",
    description: "Update the status or approval status of a ticket.",
    parameters: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID." },
        status: {
          type: "string",
          description: "New ticket status.",
          enum: ["OPEN", "ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL", "RESOLVED", "REJECTED"],
        },
        approvalStatus: {
          type: "string",
          description: "New approval status.",
          enum: ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"],
        },
      },
      required: ["ticketId", "status"],
    },
  },
  {
    name: "log_agent_action",
    description: "Log an agent action for audit and visualization purposes.",
    parameters: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "The request/session ID." },
        agent: { type: "string", description: "Agent name (e.g. IT Agent, Facilities Agent)." },
        action: { type: "string", description: "Description of the action taken." },
        tool: { type: "string", description: "Tool name called." },
        input: { type: "string", description: "JSON-stringified tool input." },
        result: { type: "string", description: "JSON-stringified tool result." },
        status: { type: "string", description: "Outcome status.", enum: ["SUCCESS", "ERROR", "PENDING"] },
      },
      required: ["requestId", "agent", "action", "tool", "input", "result", "status"],
    },
  },
];
