// agents/it-agent.ts  – P6 IT Agent
// Deterministic tool workflow:
//   check_device/check_asset -> get_previous_tickets -> [search_policy] ->
//   determine priority (code) -> create_ticket -> assign_ticket ->
//   [update_ticket if prior open ticket matches context exactly] -> log all actions
// Returns typed AgentResult. Never claims physical repair. Never rethrows.

import { generateStructured } from "@/lib/gemini";
import { executeTool } from "@/tools/registry";
import type {
  RequestContext,
  IssueContext,
  AgentResult,
  AgentEvaluation,
  PriorityLevel,
} from "./types";

// ---------------------------------------------------------------------------
// Deterministic priority from issue context + asset/ticket state
// ---------------------------------------------------------------------------
function computePriority(
  issue: IssueContext,
  assetStatus: string,
  hasMatchingTicket: boolean,
): PriorityLevel {
  const combined = [
    issue.severity,
    issue.urgency,
    issue.impact,
    issue.entities.deadline ?? "",
    assetStatus,
  ]
    .join(" ")
    .toLowerCase();

  const isCritical = ["critical", "total failure", "security"].some((k) =>
    combined.includes(k),
  );
  const isHigh =
    [
      "client",
      "meeting",
      "tomorrow",
      "urgent",
      "multiple",
      "several people",
      "blocker",
    ].some((k) => combined.includes(k)) || hasMatchingTicket; // Recurring exact issue = escalate
  const isLow = ["minor", "cosmetic", "slow", "no rush"].some((k) =>
    combined.includes(k),
  );

  if (isCritical) return "CRITICAL";
  if (isHigh) return "HIGH";
  if (isLow && !isHigh && !isCritical) return "LOW";
  return issue.recommendedPriority ?? "MEDIUM";
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
      agent: "IT Agent",
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
export async function runItAgent(
  context: RequestContext,
  issue: IssueContext,
): Promise<AgentResult> {
  await log(
    context.requestId,
    "Starting IT investigation",
    "None",
    { issue: issue.description },
    "started",
    "SUCCESS",
  );

  // --- Step 1: check_device or check_asset ---
  let assetStatus = "";
  if (issue.entities.device) {
    try {
      const res = await executeTool("check_device", {
        employeeId: context.employeeId,
        deviceType: issue.entities.device,
      });
      assetStatus = JSON.stringify(res);
      await log(
        context.requestId,
        "Checked device",
        "check_device",
        { deviceType: issue.entities.device },
        res,
        "SUCCESS",
      );
    } catch (e) {
      assetStatus = "unknown";
      await log(
        context.requestId,
        "Checked device",
        "check_device",
        { deviceType: issue.entities.device },
        String(e),
        "ERROR",
      );
    }
  } else {
    try {
      const res = await executeTool("check_asset", {
        name: issue.entities.asset ?? "",
        location: issue.entities.room ?? "",
      });
      assetStatus = JSON.stringify(res);
      await log(
        context.requestId,
        "Checked asset",
        "check_asset",
        { name: issue.entities.asset, location: issue.entities.room },
        res,
        "SUCCESS",
      );
    } catch (e) {
      assetStatus = "unknown";
      await log(
        context.requestId,
        "Checked asset",
        "check_asset",
        { name: issue.entities.asset, location: issue.entities.room },
        String(e),
        "ERROR",
      );
    }
  }

  // --- Step 2: get_previous_tickets ---
  type TicketRow = {
    id: number;
    title: string;
    description: string;
    status: string;
    priority: string;
    createdAt: Date;
  };
  let previousTickets: TicketRow[] = [];
  try {
    const res = await executeTool("get_previous_tickets", {
      employeeId: context.employeeId,
      category: "IT",
    });
    const raw = res as { count: number; tickets: TicketRow[] };
    previousTickets = raw.tickets ?? [];
    await log(
      context.requestId,
      "Checked previous IT tickets",
      "get_previous_tickets",
      { employeeId: context.employeeId },
      res,
      "SUCCESS",
    );
  } catch (e) {
    await log(
      context.requestId,
      "Checked previous IT tickets",
      "get_previous_tickets",
      { employeeId: context.employeeId },
      String(e),
      "ERROR",
    );
  }

  // Determine if there's a GENUINELY MATCHING recent unresolved ticket
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const matchingTickets = previousTickets.filter((t) => {
    if (t.status === "RESOLVED" || t.status === "REJECTED") return false;

    // Must be created within the last 7 days
    if (now - new Date(t.createdAt).getTime() > SEVEN_DAYS_MS) return false;

    const tStr = (t.title + " " + (t.description || "")).toLowerCase();

    if (
      issue.entities.device &&
      tStr.includes(issue.entities.device.toLowerCase())
    )
      return true;
    if (
      issue.entities.asset &&
      tStr.includes(issue.entities.asset.toLowerCase())
    )
      return true;

    // If no explicit device/asset matched, fall back to matching some core nouns from the description
    const descLower = issue.description.toLowerCase();
    if (descLower.includes("projector") && tStr.includes("projector"))
      return true;
    if (descLower.includes("laptop") && tStr.includes("laptop")) return true;
    if (descLower.includes("printer") && tStr.includes("printer")) return true;

    return false;
  });

  const priorOpen = matchingTickets.length > 0 ? matchingTickets[0] : null;

  // --- Step 3: Compute priority deterministically, refine with Gemini ---
  const priority = computePriority(issue, assetStatus, !!priorOpen);

  let evaluation: AgentEvaluation = {
    needsPolicySearch: false,
    policySearchQuery: "",
    finalPriority: priority,
    ticketTitle: `IT Issue: ${issue.description.slice(0, 80)}`,
    ticketDescription: issue.description,
  };

  try {
    const prompt = `You are the IT Agent for OfficeFlow AI.
Issue: ${JSON.stringify({ description: issue.description, entities: issue.entities })}
Asset state: ${assetStatus}
Matching Tickets: ${JSON.stringify(matchingTickets.slice(0, 2))}
Priority already determined by system: ${priority}

Provide:
- needsPolicySearch: true/false (search if hardware/software replacement/setup is mentioned)
- policySearchQuery: search query if needed (else "")
- finalPriority: ${priority} (keep this unless clearly wrong)
- ticketTitle: concise title (max 100 chars)
- ticketDescription: one paragraph description. Do NOT claim repair is done.

Return JSON: { "needsPolicySearch": bool, "policySearchQuery": str, "finalPriority": str, "ticketTitle": str, "ticketDescription": str }`;

    const geminiEval = await generateStructured<AgentEvaluation>(
      prompt,
      "Evaluate IT issue",
    );
    if (geminiEval?.ticketTitle) {
      evaluation = {
        ...geminiEval,
        finalPriority: priority, // deterministic priority wins
      };
    }
  } catch (error) {
    await log(
      context.requestId,
      "Gemini IT evaluation failed",
      "generateStructured",
      "Evaluate IT issue",
      String(error),
      "ERROR",
    );

    // Fallback deterministic policy lookup if Gemini fails
    const t = issue.description.toLowerCase();
    if (
      t.includes("projector") ||
      t.includes("hardware") ||
      t.includes("laptop") ||
      t.includes("computer")
    ) {
      evaluation.needsPolicySearch = true;
      evaluation.policySearchQuery = "IT hardware support policy";
    }
  }

  // --- Step 4: Optional policy search ---
  let policyNote = "";
  if (evaluation.needsPolicySearch && evaluation.policySearchQuery) {
    try {
      const policyRes = await executeTool("search_policy", {
        query: evaluation.policySearchQuery,
      });
      policyNote = `\n\nPolicy reference: ${JSON.stringify(policyRes)}`;
      await log(
        context.requestId,
        "Policy search",
        "search_policy",
        { query: evaluation.policySearchQuery },
        policyRes,
        "SUCCESS",
      );
    } catch (e) {
      await log(
        context.requestId,
        "Policy search",
        "search_policy",
        { query: evaluation.policySearchQuery },
        String(e),
        "ERROR",
      );
    }
  }

  // --- Step 5: create_ticket ---
  let ticketId: number | null = null;
  try {
    const ticketRes = (await executeTool("create_ticket", {
      employeeId: context.employeeId,
      category: "IT",
      title: evaluation.ticketTitle,
      description: evaluation.ticketDescription + policyNote,
      priority: evaluation.finalPriority,
      assignedTeam: "IT",
      requiresApproval: false,
    })) as { ticketId: number };
    ticketId = ticketRes.ticketId;
    await log(
      context.requestId,
      "Created IT ticket",
      "create_ticket",
      { title: evaluation.ticketTitle },
      ticketRes,
      "SUCCESS",
    );
  } catch (e) {
    await log(
      context.requestId,
      "Created IT ticket",
      "create_ticket",
      { title: evaluation.ticketTitle },
      String(e),
      "ERROR",
    );
  }

  // --- Step 6: assign_ticket ---
  if (ticketId !== null) {
    try {
      const assignRes = await executeTool("assign_ticket", {
        ticketId,
        assignedTo: "it.admin@example.com",
      });
      await log(
        context.requestId,
        "Assigned IT ticket",
        "assign_ticket",
        { ticketId },
        assignRes,
        "SUCCESS",
      );
    } catch (e) {
      await log(
        context.requestId,
        "Assigned IT ticket",
        "assign_ticket",
        { ticketId },
        String(e),
        "ERROR",
      );
    }

    // --- Step 7: update_ticket if there was a prior matching open ticket ---
    if (priorOpen) {
      try {
        const updateRes = await executeTool("update_ticket", {
          ticketId: priorOpen.id,
          status: "IN_PROGRESS",
        });
        await log(
          context.requestId,
          "Updated genuinely matching prior ticket",
          "update_ticket",
          { ticketId: priorOpen.id },
          updateRes,
          "SUCCESS",
        );
      } catch (e) {
        await log(
          context.requestId,
          "Updated prior ticket",
          "update_ticket",
          { ticketId: priorOpen.id },
          String(e),
          "ERROR",
        );
      }
    }
  }

  await log(
    context.requestId,
    "IT Agent complete",
    "None",
    {},
    { ticketId, priority: evaluation.finalPriority },
    "SUCCESS",
  );

  return {
    agent: "IT Agent",
    category: "IT",
    ticketId,
    priority: evaluation.finalPriority as PriorityLevel,
    requiresApproval: false,
    status: ticketId !== null ? "SUCCESS" : "PARTIAL",
  };
}
