/**
 * tools/log-agent-action.ts
 */
import { z } from "zod";
import { logAgentAction } from "@/services/ticket-service";

export const LogAgentActionInputSchema = z.object({
  requestId: z.string().min(1),
  agent: z.string().min(1),
  action: z.string().min(1),
  tool: z.string(),
  input: z.string(),
  result: z.string(),
  status: z.enum(["SUCCESS", "ERROR", "PENDING"]),
});
export type LogAgentActionInput = z.infer<typeof LogAgentActionInputSchema>;

export async function logAgentActionTool(raw: unknown) {
  const input = LogAgentActionInputSchema.parse(raw);
  const log = await logAgentAction(input);
  return { logId: log.id, timestamp: log.timestamp };
}
