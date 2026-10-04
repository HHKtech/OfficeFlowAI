/**
 * tools/check-device.ts
 */
import { z } from "zod";
import { getDeviceByEmployeeAndType, getDevicesByEmployee } from "@/services/asset-service";

export const CheckDeviceInputSchema = z.object({
  employeeId: z.number().int().positive(),
  deviceType: z.string().optional(),
});
export type CheckDeviceInput = z.infer<typeof CheckDeviceInputSchema>;

export async function checkDevice(raw: unknown) {
  const input = CheckDeviceInputSchema.parse(raw);
  if (input.deviceType) {
    const device = await getDeviceByEmployeeAndType(input.employeeId, input.deviceType);
    return device
      ? { found: true, device }
      : { found: false, message: `No ${input.deviceType} found for employee ${input.employeeId}` };
  }
  const devices = await getDevicesByEmployee(input.employeeId);
  return { found: devices.length > 0, devices };
}
