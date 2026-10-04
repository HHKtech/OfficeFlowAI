/**
 * services/asset-service.ts
 * Server-side only. Agents must never call Prisma directly.
 */
import prisma from "@/lib/db";

export async function getAssetByName(name: string) {
  return prisma.officeAsset.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
  });
}

export async function getAssetsByLocation(location: string) {
  return prisma.officeAsset.findMany({
    where: { location: { contains: location, mode: "insensitive" } },
  });
}

export async function getDeviceByEmployeeAndType(
  employeeId: number,
  type: string
) {
  return prisma.device.findFirst({
    where: {
      employeeId,
      type: { contains: type, mode: "insensitive" },
    },
  });
}

export async function getDevicesByEmployee(employeeId: number) {
  return prisma.device.findMany({ where: { employeeId } });
}
