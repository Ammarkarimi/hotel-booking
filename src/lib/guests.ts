import { z } from "zod";

const optionalText = z.string().trim().optional().nullable();

export const guestSchema = z.object({
  firstName: z.string().trim().min(1, "Guest name is required"),
  lastName: z.string().trim().optional().default(""),
  phone: z.string().trim().min(5, "Please enter a valid phone number"),
  email: z.string().trim().email("Email is not valid").optional().nullable().or(z.literal("")),
  nationality: z.string().trim().optional().default("Indian"),
  address: optionalText,
  idType: optionalText,
  idNumber: optionalText,
  company: optionalText,
  gstin: optionalText,
  dateOfBirth: optionalText,
  passportNo: optionalText,
  visaNo: optionalText,
  notes: optionalText,
  vip: z.boolean().optional(),
  blacklisted: z.boolean().optional(),
});

export type GuestInput = z.infer<typeof guestSchema>;

export function guestData(body: Partial<GuestInput>) {
  const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
  return {
    ...(body.firstName !== undefined && { firstName: body.firstName }),
    ...(body.lastName !== undefined && { lastName: body.lastName || "" }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.nationality !== undefined && { nationality: body.nationality || "Indian" }),
    email: text(body.email),
    address: text(body.address),
    idType: text(body.idType),
    idNumber: text(body.idNumber),
    company: text(body.company),
    gstin: text(body.gstin?.toUpperCase()),
    passportNo: text(body.passportNo),
    visaNo: text(body.visaNo),
    notes: text(body.notes),
    dateOfBirth: body.dateOfBirth === undefined ? undefined : body.dateOfBirth ? new Date(`${body.dateOfBirth.slice(0, 10)}T00:00:00Z`) : null,
    ...(body.vip !== undefined && { vip: body.vip }),
    ...(body.blacklisted !== undefined && { blacklisted: body.blacklisted }),
  };
}
