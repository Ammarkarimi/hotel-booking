import { z } from "zod";
import { stringifyAmenities } from "./utils";

export const roomSchema = z.object({
  roomNumber: z.string().trim().min(1, "Room number is required").max(20),
  type: z.string().trim().min(1, "Room type is required"),
  floor: z.string().trim().optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(50).default(2),
  pricePerNight: z.coerce.number().min(0, "Price cannot be negative"),
  description: z.string().trim().optional().nullable(),
  amenities: z.union([z.array(z.string()), z.string()]).optional(),
  status: z.enum(["available", "maintenance"]).optional(),
});

export function amenitiesToString(amenities: string[] | string | undefined) {
  if (amenities === undefined) return undefined;
  return stringifyAmenities(Array.isArray(amenities) ? amenities : amenities.split(","));
}
