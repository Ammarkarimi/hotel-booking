// The guest form sent on WhatsApp: what the guest fills in, and the checks on it.
// No database code here, so the guest's page and the staff screens can use it too.
import { z } from "zod";
import { diffDays, isDateKey } from "./dates";

/** How long a guest can use the link before the desk has to send it again. */
export const FORM_DAYS = 7;
/** Most ID copies one form can hold (front and back for several people). */
export const MAX_FORM_FILES = 24;
/** Most ID copies for one person. */
export const MAX_FILES_PER_PERSON = 4;

/**
 * ID proofs a guest can upload. Copies only: the form never asks for an ID number. Aadhaar is not
 * uploaded or saved at all: the front desk checks the card at check-in instead.
 */
export const FORM_ID_TYPES = ["passport", "visa", "driving_licence", "voter_id", "pan", "other"] as const;

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

export function isIndian(nationality: string | null | undefined) {
  return !nationality || nationality.trim().toLowerCase() === "indian" || nationality.trim().toLowerCase() === "india";
}

const name = (msg: string) => z.string().trim().min(1, msg).max(80);
const phone = z.string().trim().max(20).regex(/^[+\d][\d\s-]*$/, "Please check the mobile number");

export const guestFormSchema = z
  .object({
    firstName: name("Please enter your first name"),
    lastName: z.string().trim().max(80).default(""),
    phone: phone.min(6, "Please enter your mobile number"),
    email: z.string().trim().email("Please check the email address").max(120).optional().or(z.literal("")),
    dateOfBirth: z.string().refine(isDateKey, "Please enter your date of birth"),
    nationality: z.string().trim().min(2, "Please enter your nationality").max(40).default("Indian"),
    address: z.string().trim().min(3, "Please enter your house and street").max(200),
    city: z.string().trim().min(2, "Please enter your city").max(60),
    state: z.string().trim().max(60).default(""),
    pinCode: z.string().trim().max(12).default(""),
    checkIn: z.string().refine(isDateKey, "Please choose your arrival date"),
    checkOut: z.string().refine(isDateKey, "Please choose your leaving date"),
    adults: z.coerce.number().int().min(1, "At least one adult").max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),
    comingFrom: z.string().trim().min(2, "Please say which city you are coming from").max(80),
    goingTo: z.string().trim().max(80).default(""),
    vehicleNumber: z.string().trim().max(20).default(""),
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
    consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to agree" }) }),
  })
  .superRefine((d, ctx) => {
    const issue = (message: string, path: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
    if (isDateKey(d.checkIn) && isDateKey(d.checkOut) && diffDays(d.checkIn, d.checkOut) < 1) issue("The leaving date must be after the arrival date", "checkOut");
    if (isDateKey(d.checkIn) && isDateKey(d.checkOut) && diffDays(d.checkIn, d.checkOut) > 60) issue("For stays longer than 60 nights please call the hotel", "checkOut");
    if (d.companions.length !== d.adults - 1) issue("Please enter the name of each adult staying with you", "companions");
    if (isIndian(d.nationality)) {
      if (!d.state) issue("Please choose your state", "state");
      if (!/^\d{6}$/.test(d.pinCode.replace(/\s/g, ""))) issue("Please enter your 6-digit PIN code", "pinCode");
    }
  });

export type GuestFormDetails = z.infer<typeof guestFormSchema>;

/**
 * While the guest is filling in the form, each copy says whose it is by number:
 * "0" is the guest, "1" the first adult staying with them, and so on.
 */
export type FormFile = { person: string | null; type: string };

/**
 * What is still missing before the form can be sent: an ID for every adult (a copy, or their
 * Aadhaar shown at check-in), and a passport copy for a foreign guest.
 */
export function missingDocuments(
  details: Pick<GuestFormDetails, "nationality" | "firstName"> & { aadhaarAtDesk?: boolean; companions: { name: string; aadhaarAtDesk?: boolean }[] },
  files: FormFile[]
): string[] {
  const missing: string[] = [];
  const mine = files.filter((f) => f.person === "0");
  if (!isIndian(details.nationality)) {
    if (!mine.some((f) => f.type === "passport")) missing.push("Please upload a copy of your passport");
  } else if (!details.aadhaarAtDesk && mine.length === 0) {
    missing.push(`Please upload an ID proof for ${details.firstName || "yourself"}, or choose Aadhaar`);
  }
  details.companions.forEach((c, i) => {
    if (!c.aadhaarAtDesk && !files.some((f) => f.person === String(i + 1))) missing.push(`Please upload an ID proof for ${c.name || `adult ${i + 2}`}, or choose Aadhaar`);
  });
  return missing;
}

/** The WhatsApp message that carries the link. */
export function formMessage(o: { hotelName: string; guestName?: string | null; url: string; checkIn?: string | null; days?: number }) {
  const hello = o.guestName ? `Hello ${o.guestName.split(" ")[0]},` : "Hello,";
  return [
    `${hello} thank you for choosing ${o.hotelName}.`,
    "",
    "Please fill in your details and upload a copy of your ID proof (Aadhaar, passport, driving licence or any photo ID) for everyone staying. It takes about 2 minutes and saves time at check-in:",
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
