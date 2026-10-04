/**
 * tools/check-asset.ts
 */
import { z } from "zod";
import { getAssetByName, getAssetsByLocation } from "@/services/asset-service";

export const CheckAssetInputSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
});
export type CheckAssetInput = z.infer<typeof CheckAssetInputSchema>;

export async function checkAsset(raw: unknown) {
  const input = CheckAssetInputSchema.parse(raw);
  if (input.name) {
    const asset = await getAssetByName(input.name);
    return asset
      ? { found: true, asset }
      : { found: false, message: `No asset found matching "${input.name}"` };
  }
  if (input.location) {
    const assets = await getAssetsByLocation(input.location);
    return { found: assets.length > 0, assets };
  }
  return { found: false, message: "Provide name or location to check an asset." };
}
