/**
 * tools/search-policy.ts
 */
import { z } from "zod";
import { searchPolicies } from "@/services/policy-service";

export const SearchPolicyInputSchema = z.object({
  query: z.string().min(1),
});
export type SearchPolicyInput = z.infer<typeof SearchPolicyInputSchema>;

export async function searchPolicy(raw: unknown) {
  const input = SearchPolicyInputSchema.parse(raw);
  const policies = await searchPolicies(input.query);
  return {
    found: policies.length > 0,
    count: policies.length,
    policies,
  };
}
