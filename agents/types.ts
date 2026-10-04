// agents/types.ts
// Shared typed contracts for the agent system.

export interface RequestContext {
  employeeId: number;
  message: string;
  requestId: string;
}

export interface ExtractedEntities {
  device?: string;
  room?: string;
  asset?: string;
  softwareOrAccess?: string;
  deadline?: string;
}

export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IssueCategory = "IT" | "FACILITIES" | "SECURITY";

export interface IssueContext {
  description: string;
  category: IssueCategory;
  entities: ExtractedEntities;
  severity: string;
  urgency: string;
  impact: string;
  users?: string;
  recommendedPriority: PriorityLevel;
}

export interface OrchestratorAnalysis {
  issues: IssueContext[];
}

// Typed structured result returned by every specialized agent.
export interface AgentResult {
  agent: string;
  category: IssueCategory;
  ticketId: number | null;
  priority: PriorityLevel;
  requiresApproval: boolean;
  riskLevel?: string;
  recommendedAction?: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  error?: string;
}

// Final aggregated orchestrator return.
export interface OrchestratorResult {
  requestId: string;
  issuesDetected: number;
  agentsUsed: string[];
  agentResults: AgentResult[];
  ticketsCreated: number[];
  requiresApproval: boolean;
  finalResponse: string;
}

// Gemini evaluation returned by IT / Facilities agents.
export interface AgentEvaluation {
  needsPolicySearch: boolean;
  policySearchQuery: string;
  finalPriority: PriorityLevel;
  ticketTitle: string;
  ticketDescription: string;
}

// Gemini evaluation returned by Security agent.
export interface SecurityEvaluation {
  incidentType: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requiresApproval: boolean;
  ticketTitle: string;
  ticketDescription: string;
  recommendedAction: string;
}
