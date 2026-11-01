import { z } from "zod";
import { maskAadhaar } from "./guest-form";

const optionalText = z.string().trim().optional().nullable();

const guestFields = z.object({
  firstName: z.string().trim().min(1, "Guest name is required"),
  lastName: z.string().trim().optional().default(""),
  phone: z.string().trim().min(5, "Please enter a valid phone number"),
  email: z.string().trim().email("Email is not valid").optional().nullable().or(z.literal("")),
  nationality: z.string().trim().optional().default("Indian"),
  address: optionalText,
  city: optionalText,
  state: optionalText,
  pinCode: optionalText,
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

const aadhaarOk = (g: { idType?: string | null; idNumber?: string | null }) => g.idType !== "aadhar" || !g.idNumber || g.idNumber.replace(/\D/g, "").length >= 4;
const aadhaarIssue = { message: "For Aadhaar, enter the last 4 digits", path: ["idNumber"] };

export const guestSchema = guestFields.refine(aadhaarOk, aadhaarIssue);
/** For changing some details of a guest. */
export const guestUpdateSchema = guestFields.partial().refine(aadhaarOk, aadhaarIssue);

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
    city: text(body.city),
    state: text(body.state),
    pinCode: text(body.pinCode),
    idType: text(body.idType),
    // Only the last 4 digits of an Aadhaar are kept ("XXXX XXXX 1234"); the copy of the card is the proof.
    idNumber: body.idType === "aadhar" ? (body.idNumber === undefined ? undefined : maskAadhaar(body.idNumber)) : text(body.idNumber),
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
