import { z } from "zod";

const optionalText = z.string().trim().optional().nullable();

const guestFields = z.object({
  firstName: z.string().trim().min(1, "Guest name is required"),
  lastName: z.string().trim().optional().default(""),
  phone: z.string().trim().min(5, "Please enter a valid phone number"),
  email: z.string().trim().email("Email is not valid").optional().nullable().or(z.literal("")),
  nationality: z.string().trim().optional().default("Indian"),
  address: optionalText,
  locality: optionalText,
  city: optionalText,
  district: optionalText,
  state: optionalText,
  pinCode: optionalText,
  idType: optionalText,
  company: optionalText,
  gstin: optionalText,
  dateOfBirth: optionalText,
  notes: optionalText,
  vip: z.boolean().optional(),
  blacklisted: z.boolean().optional(),
});

export const guestSchema = guestFields;
/** For changing some details of a guest. */
export const guestUpdateSchema = guestFields.partial();

export type GuestInput = z.infer<typeof guestFields>;

export function guestData(body: Partial<GuestInput>) {
  const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
  return {
    ...(body.firstName !== undefined && { firstName: body.firstName }),
    ...(body.lastName !== undefined && { lastName: body.lastName || "" }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.nationality !== undefined && { nationality: body.nationality || "Indian" }),
    email: text(body.email),
    address: text(body.address),
    locality: text(body.locality),
    city: text(body.city),
    district: text(body.district),
    state: text(body.state),
    pinCode: text(body.pinCode),
    // Only which ID the guest has: no ID, passport or visa number is kept.
    idType: text(body.idType),
    company: text(body.company),
    gstin: text(body.gstin?.toUpperCase()),
    notes: text(body.notes),
    dateOfBirth: body.dateOfBirth === undefined ? undefined : body.dateOfBirth ? new Date(`${body.dateOfBirth.slice(0, 10)}T00:00:00Z`) : null,
    ...(body.vip !== undefined && { vip: body.vip }),
    ...(body.blacklisted !== undefined && { blacklisted: body.blacklisted }),
  };
}
