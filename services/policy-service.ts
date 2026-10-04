/**
 * services/policy-service.ts
 * Server-side only. Agents must never call Prisma directly.
 */
import prisma from "@/lib/db";

export async function searchPolicies(query: string) {
  return prisma.policy.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 5,
  });
}
