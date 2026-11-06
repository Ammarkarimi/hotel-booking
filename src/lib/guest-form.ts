// The guest form sent on WhatsApp: what the guest fills in, and the checks on it.
// No database code here, so the guest's page and the staff screens can use it too.
import { z } from "zod";
import { diffDays, isDateKey } from "./dates";

/** How long a guest can use the link before the desk has to send it again. */
export const FORM_DAYS = 7;
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

/** How the guest travels, as the police guest register (Pathik) asks for it ("Vehicle Type", a required field there). */
export const VEHICLE_TYPES = ["four_wheeler", "two_wheeler", "bus", "auto", "other", "none"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export const VEHICLE_LABELS: Record<VehicleType, string> = {
  four_wheeler: "Car",
  two_wheeler: "Two-wheeler (bike / scooter)",
  bus: "Bus",
  auto: "Auto-rickshaw",
  other: "Other vehicle",
  none: "No vehicle (train, flight or on foot)",
};
/** A vehicle with a number plate worth asking for. */
export const hasOwnVehicle = (t: string | null | undefined) => !!t && t !== "none" && t !== "bus";

export function isIndian(nationality: string | null | undefined) {
  return !nationality || nationality.trim().toLowerCase() === "indian" || nationality.trim().toLowerCase() === "india";
}

const name = (msg: string) => z.string().trim().min(1, msg).max(80);
const phone = z.string().trim().max(20).regex(/^[+\d][\d\s-]*$/, "Please check the mobile number");

/** Everything on the form, without the guest's agreement (staff use this when they correct the details). */
const formFields = z.object({
  firstName: name("Please enter your first name"),
  lastName: z.string().trim().max(80).default(""),
  phone: phone.min(6, "Please enter your mobile number"),
  email: z.string().trim().email("Please check the email address").max(120).optional().or(z.literal("")),
  dateOfBirth: z.string().refine(isDateKey, "Please enter your date of birth"),
  nationality: z.string().trim().min(2, "Please enter your nationality").max(40).default("Indian"),
  address: z.string().trim().min(3, "Please enter your house and street").max(200),
  locality: z.string().trim().max(80).default(""),
  city: z.string().trim().min(2, "Please enter your city").max(60),
  district: z.string().trim().max(60).default(""),
  state: z.string().trim().max(60).default(""),
  pinCode: z.string().trim().max(12).default(""),
  checkIn: z.string().refine(isDateKey, "Please choose your arrival date"),
  checkOut: z.string().refine(isDateKey, "Please choose your leaving date"),
  adults: z.coerce.number().int().min(1, "At least one adult").max(20),
  children: z.coerce.number().int().min(0).max(20).default(0),
  comingFrom: z.string().trim().min(2, "Please say which city you are coming from").max(80),
  goingTo: z.string().trim().max(80).default(""),
  vehicleNumber: z.string().trim().max(20).default(""),
  vehicleType: z.enum(["", ...VEHICLE_TYPES]).default(""),
  // The guest will show their Aadhaar at check-in, where the front desk checks it (nothing is uploaded).
  aadhaarAtDesk: z.boolean().default(false),
  companions: z
    .array(
      z.object({
        name: name("Please enter the name of each adult staying with you"),
        phone: phone.optional().or(z.literal("")),
        aadhaarAtDesk: z.boolean().optional(),
      })
    )
    .max(19)
    .default([]),
  requests: z.string().trim().max(500).default(""),
});

type FormFields = z.infer<typeof formFields>;

function checkForm(d: FormFields, ctx: z.RefinementCtx) {
  const issue = (message: string, path: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
  if (isDateKey(d.checkIn) && isDateKey(d.checkOut) && diffDays(d.checkIn, d.checkOut) < 1) issue("The leaving date must be after the arrival date", "checkOut");
  if (isDateKey(d.checkIn) && isDateKey(d.checkOut) && diffDays(d.checkIn, d.checkOut) > 60) issue("For stays longer than 60 nights please call the hotel", "checkOut");
  if (d.companions.length !== d.adults - 1) issue("Please enter the name of each adult staying with you", "companions");
  // ID ticks say whose they are by name, so two adults cannot have the same name.
  const names = d.companions.map((c) => c.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) issue("Two adults have the same name. Please add a surname so they can be told apart", "companions");
  if (isIndian(d.nationality)) {
    if (!d.state) issue("Please choose your state", "state");
    if (!/^\d{6}$/.test(d.pinCode.replace(/\s/g, ""))) issue("Please enter your 6-digit PIN code", "pinCode");
  }
}

/**
 * What the guest sends. The police form (Pathik) also needs the locality and district of an Indian
 * address, where the guest goes next and how they travel.
 */
export const guestFormSchema = formFields
  .extend({ consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to agree" }) }) })
  .superRefine(checkForm)
  .superRefine((d, ctx) => {
    const issue = (message: string, path: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
    if (isIndian(d.nationality) && !d.locality) issue("Please enter your area or locality", "locality");
    if (isIndian(d.nationality) && !d.district) issue("Please enter your district", "district");
    if (d.goingTo.length < 2) issue("Please say which city you are going to next", "goingTo");
    if (!d.vehicleType) issue("Please choose how you are travelling", "vehicleType");
  });

/** The same details when the front desk corrects them: the same checks, no agreement box. */
export const staffFormSchema = formFields.superRefine(checkForm);

export type GuestFormDetails = z.infer<typeof formFields> & { consent?: true };

/** Details as saved: PIN without spaces, and no Aadhaar for a foreign guest (they show a passport). */
export function cleanDetails<T extends FormFields>(d: T): T {
  return { ...d, pinCode: d.pinCode.replace(/\s/g, ""), aadhaarAtDesk: isIndian(d.nationality) && d.aadhaarAtDesk };
}

/** The WhatsApp message that carries the link. */
export function formMessage(o: { hotelName: string; guestName?: string | null; url: string; checkIn?: string | null; days?: number }) {
  const hello = o.guestName ? `Hello ${o.guestName.split(" ")[0]},` : "Hello,";
  return [
    `${hello} thank you for choosing ${o.hotelName}.`,
    "",
    "Please fill in your details for everyone staying. Bring an original photo ID for every adult (Aadhaar, driving licence, voter ID or passport) to show at check-in: nothing is uploaded. It takes about 2 minutes and saves time at check-in:",
    o.url,
    "",
    `The link works for ${o.days ?? FORM_DAYS} days.`,
  ].join("\n");
}

/** The form's state as staff and the guest see it: a link not filled in by its last day has expired. */
export function formStatus(f: { status: string; expiresAt: Date | string }, now = new Date()) {
  if (f.status === "sent" && new Date(f.expiresAt) < now) return "expired";
  return f.status;
}

/** One line for the full address, as printed on the registration card. */
export function fullAddress(g: { address?: string | null; city?: string | null; state?: string | null; pinCode?: string | null }) {
  const place = [g.city, g.state].filter(Boolean).join(", ");
  return [g.address, [place, g.pinCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export type Companion = { name: string; phone?: string; aadhaarAtDesk?: boolean };

export function parseCompanions(raw: string | null | undefined): Companion[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((c) => c && typeof c.name === "string") : [];
  } catch {
    return [];
  }
}

/** A booking typed at the front desk, as checked against what Pathik's Add Guest form requires. */
export interface DeskPathikDetails {
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  address?: string | null;
  locality?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pinCode?: string | null;
  dateOfBirth?: string | Date | null;
  comingFrom?: string | null;
  goingTo?: string | null;
  vehicleType?: string | null;
  adults: number;
  companions: { name: string }[];
}

/**
 * What is still missing before a desk booking can be entered in Pathik, as labels for the screen.
 * Empty = ready. Used by New booking and checked again by the server when Pathik is switched on.
 */
export function deskPathikMissing(d: DeskPathikDetails): string[] {
  const missing: string[] = [];
  const has = (v: unknown) => (typeof v === "string" ? v.trim() !== "" : !!v);
  const need = (v: unknown, label: string) => !has(v) && missing.push(label);
  const indian = isIndian(d.nationality);
  need(d.lastName, "Last name");
  need(d.phone, "Mobile number");
  need(d.email, "Email");
  need(d.address, "House and street");
  if (indian) need(d.locality, "Area / locality");
  need(d.city, "City");
  if (indian) {
    need(d.district, "District");
    need(d.state, "State");
    if (!/^\d{6}$/.test((d.pinCode ?? "").replace(/\s/g, ""))) missing.push("6-digit PIN code");
  }
  need(d.dateOfBirth, "Date of birth");
  need(d.comingFrom, "Coming from");
  need(d.goingTo, "Going to next");
  need(d.vehicleType, "How they are travelling");
  const named = d.companions.filter((c) => has(c.name)).length;
  const others = Math.max(0, d.adults - 1);
  if (named < others) missing.push(others - named === 1 ? `Full name of adult ${named + 2}` : `Full names of ${others - named} other adults`);
  return missing;
}
