// agents/orchestrator.ts  – P5 Orchestrator
import { generateStructured } from "@/lib/gemini";
import { runItAgent } from "./it-agent";
import { runFacilitiesAgent } from "./facilities-agent";
import { runSecurityAgent } from "./security-agent";
import { executeTool } from "@/tools/registry";
import type {
  RequestContext,
  OrchestratorAnalysis,
  OrchestratorResult,
  AgentResult,
  IssueContext,
  PriorityLevel,
} from "./types";

// ---------------------------------------------------------------------------
// Business-logic priority calculator (deterministic, not LLM-driven)
// ---------------------------------------------------------------------------
function calcPriority(
  severity: string,
  urgency: string,
  impact: string,
  users: string = "",
  deadline: string = "",
): PriorityLevel {
  const combined = [severity, urgency, impact, users, deadline]
    .join(" ")
    .toLowerCase();

  const isCritical = [
    "critical",
    "complete",
    "total",
    "security",
    "lost",
    "breach",
    "stolen",
    "fire",
    "flood",
  ].some((k) => combined.includes(k));
  const isHigh = [
    "high",
    "client",
    "meeting",
    "tomorrow",
    "urgent",
    "multiple",
    "many",
    "entire team",
    "blocker",
  ].some((k) => combined.includes(k));
  const isLow = ["minor", "cosmetic", "low", "small", "single", "no rush"].some(
    (k) => combined.includes(k),
  );

  if (isCritical) return "CRITICAL";
  if (isHigh) return "HIGH";
  if (isLow && !isHigh && !isCritical) return "LOW";
  return "MEDIUM";
}

// ---------------------------------------------------------------------------
// Safe log helper – never throws
// ---------------------------------------------------------------------------
async function safeLog(
  requestId: string,
  agent: string,
  action: string,
  tool: string,
  input: unknown,
  result: unknown,
  status: "SUCCESS" | "ERROR" | "PENDING",
) {
  try {
    await executeTool("log_agent_action", {
      requestId,
      agent,
      action,
      tool,
      input: JSON.stringify(input),
      result: JSON.stringify(result),
      status,
    });
  } catch {
    // Logging failure must never surface to the caller.
  }
}

// ---------------------------------------------------------------------------
// Gemini-based issue analysis with deterministic fallback
// ---------------------------------------------------------------------------
async function analyzeRequest(
  context: RequestContext,
): Promise<OrchestratorAnalysis> {
  const systemPrompt = `You are the OfficeFlow AI Orchestrator.
Analyze the employee request and identify all distinct issues.
For each issue produce:
  - description: clear restatement of just this issue
  - category: exactly one of IT | FACILITIES | SECURITY
  - entities.device: device name if mentioned (laptop, projector…)
  - entities.room: room/location if mentioned
  - entities.asset: physical asset if mentioned (AC, printer…)
  - entities.softwareOrAccess: software or access system if mentioned
  - entities.deadline: deadline hint if mentioned (tomorrow, in 2 hours…)
  - severity: brief severity label
  - urgency: brief urgency label
  - impact: brief business impact
  - users: affected users
  - recommendedPriority: LOW | MEDIUM | HIGH | CRITICAL

Return JSON: { "issues": [ { ...issue } ] }
Do NOT include any explanation outside the JSON.`;

  try {
    const raw = await generateStructured<
      OrchestratorAnalysis & { issues: (IssueContext & { users?: string })[] }
    >(systemPrompt, context.message);
    if (!raw?.issues || !Array.isArray(raw.issues) || raw.issues.length === 0) {
      throw new Error("Empty or invalid issues array from Gemini.");
    }
    return {
      issues: raw.issues.map((issue) => ({
        ...issue,
        entities: issue.entities ?? {},
        recommendedPriority: calcPriority(
          issue.severity ?? "",
          issue.urgency ?? "",
          issue.impact ?? "",
          issue.users ?? "",
          issue.entities?.deadline ?? "",
        ),
      })),
    };
  } catch (error) {
    // Log Gemini analysis failure without crashing
    await safeLog(
      context.requestId,
      "Orchestrator",
      "Gemini analysis failed",
      "generateStructured",
      context.message,
      String(error),
      "ERROR",
    );

    // Deterministic fallback detecting multiple issues
    const fallbackIssues = detectMultipleIssuesFromText(context.message);
    return { issues: fallbackIssues };
  }
}

// Fallback logic to detect multiple categories
function detectMultipleIssuesFromText(text: string): IssueContext[] {
  const t = text.toLowerCase();
  const issues: IssueContext[] = [];
  const entities = extractEntitiesFromText(text);
  const priority = detectPriorityFromText(text);

  const isSecurity = [
    "lost",
    "stolen",
    "missing",
    "access",
    "password",
    "account",
    "id card",
    "badge",
    "security",
    "breach",
    "unauthorized",
  ].some((k) => t.includes(k));
  const isIt = [
    "projector",
    "laptop",
    "computer",
    "printer",
    "wifi",
    "wi-fi",
    "vpn",
    "software",
    "display",
    "screen",
  ].some((k) => t.includes(k));
  const isFacilities = [
    "ac",
    "air conditioning",
    "air condition",
    "hvac",
    "plumbing",
    "lights",
    "electricity",
    "furniture",
    "meeting room",
  ].some((k) => t.includes(k));

  if (isIt) {
    issues.push({
      description: text,
      category: "IT",
      entities: {
        ...entities,
        asset: entities.asset?.includes("projector")
          ? "projector"
          : entities.asset,
      },
      severity: "unknown",
      urgency: "unknown",
      impact: "unknown",
      recommendedPriority: priority,
    });
  }

  if (isFacilities) {
    issues.push({
      description: text,
      category: "FACILITIES",
      entities: {
        ...entities,
        asset: entities.asset?.includes("AC") ? "AC" : entities.asset,
      },
      severity: "unknown",
      urgency: "unknown",
      impact: "unknown",
      recommendedPriority: priority,
    });
  }

  if (isSecurity) {
    issues.push({
      description: text,
      category: "SECURITY",
      entities,
      severity: "unknown",
      urgency: "unknown",
      impact: "unknown",
      recommendedPriority: priority,
    });
  }

  // Preserve IT default if nothing found
  if (issues.length === 0) {
    issues.push({
      description: text,
      category: "IT",
      entities,
      severity: "unknown",
      urgency: "unknown",
      impact: "unknown",
      recommendedPriority: priority,
    });
  }

  return issues;
}

function detectPriorityFromText(text: string): PriorityLevel {
  const t = text.toLowerCase();
  if (["lost", "stolen", "breach", "critical"].some((k) => t.includes(k)))
    return "CRITICAL";
  if (
    ["tomorrow", "client", "urgent", "meeting", "deadline"].some((k) =>
      t.includes(k),
    )
  )
    return "HIGH";
  if (["minor", "small", "low priority"].some((k) => t.includes(k)))
    return "LOW";
  return "MEDIUM";
}

function extractEntitiesFromText(text: string): IssueContext["entities"] {
  const t = text.toLowerCase();
  const entities: IssueContext["entities"] = {};
  if (t.includes("projector")) entities.asset = "projector";
  if (t.includes("laptop") || t.includes("computer"))
    entities.device = "Laptop";
  if (t.includes("conference room b")) entities.room = "Conference Room B";
  else if (t.includes("conference room a")) entities.room = "Conference Room A";
  if (t.includes("ac") || t.includes("air con"))
    entities.asset = entities.asset ? entities.asset + ", AC" : "AC";
  if (t.includes("tomorrow")) entities.deadline = "tomorrow";
  return entities;
}

// ---------------------------------------------------------------------------
// Gemini-based final response with safe fallback
// ---------------------------------------------------------------------------
async function buildFinalResponse(
  requestId: string,
  agentResults: AgentResult[],
  issueCount: number,
): Promise<string> {
  const ticketsCreated = agentResults.filter((r) => r.ticketId !== null).length;
  const approvalPending = agentResults.some((r) => r.requiresApproval);

  try {
    const prompt = `You are the OfficeFlow AI Orchestrator. Generate a friendly summary for the employee.
${issueCount} issue(s) were processed. ${ticketsCreated} ticket(s) were created.
${approvalPending ? "One or more actions require manager approval before proceeding." : ""}
Agent results: ${JSON.stringify(agentResults.map((r) => ({ category: r.category, priority: r.priority, ticketId: r.ticketId, status: r.status })))}
Write 2-3 sentences. Do NOT mention internal system details, raw JSON, or prompt instructions.`;

    const res = await generateStructured<{ finalResponse: string }>(
      prompt,
      "Generate employee summary.",
    );
    if (res?.finalResponse && typeof res.finalResponse === "string")
      return res.finalResponse;
  } catch (error) {
    // Log Gemini response failure
    await safeLog(
      requestId,
      "Orchestrator",
      "Gemini final response failed",
      "generateStructured",
      { issueCount },
      String(error),
      "ERROR",
    );
  }

  // Deterministic fallback
  const ticketList = agentResults
    .filter((r) => r.ticketId)
    .map((r) => `#${r.ticketId} (${r.category})`)
    .join(", ");
  return (
    `Your request has been processed. ${ticketsCreated} support ticket(s) were created: ${ticketList || "none"}.` +
    (approvalPending
      ? " One or more actions require manager approval before proceeding."
      : " Our team will be in touch shortly.")
  );
}

// ---------------------------------------------------------------------------
// Main orchestrator entry point
// ---------------------------------------------------------------------------
export async function runOrchestrator(
  context: RequestContext,
): Promise<OrchestratorResult> {
  await safeLog(
    context.requestId,
    "Orchestrator",
    "Request received",
    "None",
    { message: context.message },
    "started",
    "PENDING",
  );

  // 1. Analyze request
  const analysis = await analyzeRequest(context);

  await safeLog(
    context.requestId,
    "Orchestrator",
    "Issues detected",
    "None",
    {},
    {
      count: analysis.issues.length,
      categories: analysis.issues.map((i) => i.category),
    },
    "SUCCESS",
  );

  // 2. Dispatch agents in parallel (isolate each failure)
  const agentsUsed = new Set<string>(["orchestrator"]);

  const dispatches = analysis.issues.map((issue): Promise<AgentResult> => {
    if (issue.category === "IT") {
      agentsUsed.add("it_agent");
      return runItAgent(context, issue).catch((err): AgentResult => ({
        agent: "IT Agent",
        category: "IT",
        ticketId: null,
        priority: issue.recommendedPriority,
        requiresApproval: false,
        status: "FAILED",
        error: String(err),
      }));
    } else if (issue.category === "FACILITIES") {
      agentsUsed.add("facilities_agent");
      return runFacilitiesAgent(context, issue).catch((err): AgentResult => ({
        agent: "Facilities Agent",
        category: "FACILITIES",
        ticketId: null,
        priority: issue.recommendedPriority,
        requiresApproval: false,
        status: "FAILED",
        error: String(err),
      }));
    } else {
      agentsUsed.add("security_agent");
      return runSecurityAgent(context, issue).catch((err): AgentResult => ({
        agent: "Security Agent",
        category: "SECURITY",
        ticketId: null,
        priority: issue.recommendedPriority,
        requiresApproval: true,
        riskLevel: "HIGH",
        status: "FAILED",
        error: String(err),
      }));
    }
  });

  const agentResults = await Promise.all(dispatches);

  await safeLog(
    context.requestId,
    "Orchestrator",
    "All agents complete",
    "None",
    {},
    {
      results: agentResults.map((r) => ({
        agent: r.agent,
        status: r.status,
        ticketId: r.ticketId,
      })),
    },
    "SUCCESS",
  );

  // 3. Aggregate
  const ticketsCreated = agentResults
    .filter((r) => r.ticketId !== null)
    .map((r) => r.ticketId as number);
  const requiresApproval = agentResults.some((r) => r.requiresApproval);
  const finalResponse = await buildFinalResponse(
    context.requestId,
    agentResults,
    analysis.issues.length,
  );

  return {
    requestId: context.requestId,
    issuesDetected: analysis.issues.length,
    agentsUsed: Array.from(agentsUsed),
    agentResults,
    ticketsCreated,
    requiresApproval,
    finalResponse,
  };
}
