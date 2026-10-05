// agents/security-agent.ts  – P8 Security & Access Agent
// Tool workflow (deterministic):
//   get_employee -> check_employee_access -> check_device (if lost device) ->
//   search_policy -> create_ticket (requiresApproval=true for HIGH risk) ->
//   assign_ticket -> update_ticket (AWAITING_APPROVAL) -> log all actions
// NEVER auto-disables anything. Approval is enforced server-side via ticket state.
// Returns typed AgentResult with requiresApproval, riskLevel, recommendedAction.

import { generateStructured } from "@/lib/gemini";
import { executeTool } from "@/tools/registry";
import type {
  RequestContext,
  IssueContext,
  AgentResult,
  SecurityEvaluation,
  PriorityLevel,
} from "./types";

// ---------------------------------------------------------------------------
// Keywords that indicate high-risk (always require approval)
// ---------------------------------------------------------------------------
const HIGH_RISK_KEYWORDS = [
  "lost",
  "stolen",
  "missing",
  "breach",
  "compromised",
  "stolen laptop",
  "lost laptop",
  "lost phone",
  "lost device",
  "unauthorized",
  "hack",
  "data leak",
];

function isHighRisk(text: string): boolean {
  const t = text.toLowerCase();
  return HIGH_RISK_KEYWORDS.some((k) => t.includes(k));
}

function isLostDevice(text: string): boolean {
  const t = text.toLowerCase();
  return (
    (t.includes("lost") || t.includes("stolen") || t.includes("missing")) &&
    (t.includes("laptop") ||
      t.includes("phone") ||
      t.includes("device") ||
      t.includes("computer"))
  );
}

// ---------------------------------------------------------------------------
// Safe log helper
// ---------------------------------------------------------------------------
async function log(
  requestId: string,
  action: string,
  tool: string,
  input: unknown,
  result: unknown,
  status: "SUCCESS" | "ERROR" | "PENDING",
) {
  try {
    await executeTool("log_agent_action", {
      requestId,
      agent: "Security Agent",
      action,
      tool,
      input: JSON.stringify(input),
      result: JSON.stringify(result),
      status,
    });
  } catch {
    /* never surface */
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export async function runSecurityAgent(
  context: RequestContext,
  issue: IssueContext,
): Promise<AgentResult> {
  await log(
    context.requestId,
    "Starting Security investigation",
    "None",
    { issue: issue.description },
    "started",
    "SUCCESS",
  );

  const highRisk = isHighRisk(issue.description);
  const lostDevice = isLostDevice(issue.description);

  // --- Step 1: get_employee ---
  let employeeInfo: unknown = null;
  try {
    const res = await executeTool("get_employee", {
      employeeId: context.employeeId,
    });
    employeeInfo = res;
    await log(
      context.requestId,
      "Retrieved employee info",
      "get_employee",
      { employeeId: context.employeeId },
      res,
      "SUCCESS",
    );
  } catch (e) {
    await log(
      context.requestId,
      "Retrieved employee info",
      "get_employee",
      { employeeId: context.employeeId },
      String(e),
      "ERROR",
    );
  }

  // --- Step 2: check_employee_access ---
  let accessInfo: unknown = null;
  try {
    const res = await executeTool("check_employee_access", {
      employeeId: context.employeeId,
    });
    accessInfo = res;
    await log(
      context.requestId,
      "Checked employee access",
      "check_employee_access",
      { employeeId: context.employeeId },
      res,
      "SUCCESS",
    );
  } catch (e) {
    await log(
      context.requestId,
      "Checked employee access",
      "check_employee_access",
      { employeeId: context.employeeId },
      String(e),
      "ERROR",
    );
  }

  // --- Step 3: check_device (only for lost/stolen device scenarios) ---
  let deviceInfo: unknown = null;
  if (lostDevice || issue.entities.device) {
    try {
      const deviceType = issue.entities.device ?? "Laptop";
      const res = await executeTool("check_device", {
        employeeId: context.employeeId,
        deviceType,
      });
      deviceInfo = res;
      await log(
        context.requestId,
        "Checked device (lost/stolen)",
        "check_device",
        { deviceType },
        res,
        "SUCCESS",
      );
    } catch (e) {
      await log(
        context.requestId,
        "Checked device",
        "check_device",
        { employeeId: context.employeeId },
        String(e),
        "ERROR",
      );
    }
  }

  // --- Step 4: search_policy ---
  let policyInfo: unknown = null;
  try {
    const query = lostDevice
      ? "lost stolen device laptop security policy"
      : `security access ${issue.entities.softwareOrAccess ?? "incident"} policy`;
    const res = await executeTool("search_policy", { query });
    policyInfo = res;
    await log(
      context.requestId,
      "Searched security policy",
      "search_policy",
      { query },
      res,
      "SUCCESS",
    );
  } catch (e) {
    await log(
      context.requestId,
      "Searched security policy",
      "search_policy",
      {},
      String(e),
      "ERROR",
    );
  }

  // --- Step 5: Gemini evaluation (with deterministic fallback) ---
  let evaluation: SecurityEvaluation = {
    incidentType: lostDevice ? "Lost Device" : "Security Incident",
    riskLevel: highRisk ? "HIGH" : "MEDIUM",
    requiresApproval: highRisk, // ENFORCED DETERMINISTICALLY – not LLM decision
    ticketTitle: lostDevice
      ? `Lost Device Report – Employee #${context.employeeId}`
      : `Security Incident: ${issue.description.slice(0, 80)}`,
    ticketDescription: issue.description,
    recommendedAction: lostDevice
      ? "Disable device/session after security approval"
      : "Review access logs and escalate if unauthorized access confirmed",
  };

  try {
    const prompt = `You are the Security Agent for OfficeFlow AI.
Issue: ${JSON.stringify({ description: issue.description, entities: issue.entities })}
Employee info: ${JSON.stringify(employeeInfo)}
Access info: ${JSON.stringify(accessInfo)}
Device info: ${JSON.stringify(deviceInfo)}
Policy: ${JSON.stringify(policyInfo)}
Risk already determined by system: ${evaluation.riskLevel}
Approval required: ${evaluation.requiresApproval} (this is MANDATORY for high-risk, do not change)

Provide:
- incidentType: short type (Lost Device, Unauthorized Access, ID Card Issue, etc.)
- riskLevel: ${evaluation.riskLevel} (keep unless clearly wrong)
- requiresApproval: ${evaluation.requiresApproval} (do NOT set to false for high-risk)
- ticketTitle: concise (max 100 chars)
- ticketDescription: one paragraph. Do NOT claim device is disabled or action taken.
- recommendedAction: what admin should do AFTER approving

Return JSON: { "incidentType": str, "riskLevel": str, "requiresApproval": bool, "ticketTitle": str, "ticketDescription": str, "recommendedAction": str }`;

    const geminiEval = await generateStructured<SecurityEvaluation>(
      prompt,
      "Evaluate security incident",
    );
    if (geminiEval?.ticketTitle) {
      evaluation = {
        ...geminiEval,
        // Deterministic overrides: high-risk approval cannot be bypassed by LLM
        requiresApproval: highRisk || geminiEval.requiresApproval,
        riskLevel: highRisk ? "HIGH" : geminiEval.riskLevel,
      };
    }
  } catch (error) {
    await log(
      context.requestId,
      "Gemini Security evaluation failed",
      "generateStructured",
      "Evaluate security incident",
      String(error),
      "ERROR",
    );
    // Keep deterministic fallback evaluation
  }

  // --- Step 6: create_ticket (requiresApproval enforced server-side) ---
  let ticketId: number | null = null;
  try {
    const ticketPriority: PriorityLevel =
      evaluation.riskLevel === "CRITICAL"
        ? "CRITICAL"
        : evaluation.riskLevel === "HIGH"
          ? "HIGH"
          : evaluation.riskLevel === "MEDIUM"
            ? "MEDIUM"
            : "LOW";

    const ticketRes = (await executeTool("create_ticket", {
      employeeId: context.employeeId,
      category: "SECURITY",
      subcategory: evaluation.incidentType,
      title: evaluation.ticketTitle,
      description: `${evaluation.ticketDescription}\n\nRecommended action: ${evaluation.recommendedAction}\n\nPolicy reference: ${JSON.stringify(policyInfo)}\nDevice info: ${JSON.stringify(deviceInfo)}`,
      priority: ticketPriority,
      assignedTeam: "SECURITY",
      requiresApproval: evaluation.requiresApproval, // server-side enforcement
    })) as { ticketId: number };
    ticketId = ticketRes.ticketId;
    await log(
      context.requestId,
      "Created security ticket",
      "create_ticket",
      {
        title: evaluation.ticketTitle,
        requiresApproval: evaluation.requiresApproval,
      },
      ticketRes,
      "SUCCESS",
    );
  } catch (e) {
    await log(
      context.requestId,
      "Created security ticket",
      "create_ticket",
      { title: evaluation.ticketTitle },
      String(e),
      "ERROR",
    );
  }

  // --- Step 7: assign_ticket ---
  if (ticketId !== null) {
    try {
      const assignRes = await executeTool("assign_ticket", {
        ticketId,
        assignedTo: "security.admin@example.com",
      });
      await log(
        context.requestId,
        "Assigned security ticket",
        "assign_ticket",
        { ticketId },
        assignRes,
        "SUCCESS",
      );
    } catch (e) {
      await log(
        context.requestId,
        "Assigned security ticket",
        "assign_ticket",
        { ticketId },
        String(e),
        "ERROR",
      );
    }

    // --- Step 8: update_ticket to AWAITING_APPROVAL if requiresApproval ---
    // This is enforced in code, not just as a prompt instruction.
    if (evaluation.requiresApproval) {
      try {
        const updateRes = await executeTool("update_ticket", {
          ticketId,
          status: "AWAITING_APPROVAL",
          approvalStatus: "PENDING",
        });
        await log(
          context.requestId,
          "Set ticket to AWAITING_APPROVAL",
          "update_ticket",
          { ticketId },
          updateRes,
          "SUCCESS",
        );
      } catch (e) {
        await log(
          context.requestId,
          "Set ticket to AWAITING_APPROVAL",
          "update_ticket",
          { ticketId },
          String(e),
          "ERROR",
        );
      }
    }
  }

  await log(
    context.requestId,
    "Security Agent complete",
    "None",
    {},
    {
      ticketId,
      requiresApproval: evaluation.requiresApproval,
      riskLevel: evaluation.riskLevel,
    },
    "SUCCESS",
  );

  return {
    agent: "Security Agent",
    category: "SECURITY",
    ticketId,
    priority: (evaluation.riskLevel === "CRITICAL"
      ? "CRITICAL"
      : evaluation.riskLevel === "HIGH"
        ? "HIGH"
        : "MEDIUM") as PriorityLevel,
    requiresApproval: evaluation.requiresApproval,
    riskLevel: evaluation.riskLevel,
    recommendedAction: evaluation.recommendedAction,
    status: ticketId !== null ? "SUCCESS" : "PARTIAL",
  };
}
