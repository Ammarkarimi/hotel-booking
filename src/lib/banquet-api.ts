// Shared by the banquet API routes: what a function form may contain.
import { z } from "zod";
import { dateFromKey, isDateKey } from "./dates";
import { BANQUET_ITEM_CATEGORIES, EVENT_TYPES, FOOD_TYPES, SEATING_STYLES, SESSIONS } from "./banquet-bill";
import { PAYMENT_METHODS } from "./utils";

const text = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);
const time = (what: string) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `Please choose the ${what} time`);
const gst = z.coerce.number().min(0, "GST cannot be less than 0%").max(40, "Please check the GST %");
const day = (what: string) => z.string().refine(isDateKey, `Please choose the ${what}`);

export const banquetFields = z.object({
  customerName: z.string().trim().min(1, "Please type the customer's name").max(120),
  phone: z.string().trim().min(6, "Please type the customer's mobile number").max(20),
  email: text(120),
  company: text(120),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .max(15)
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => !v || /^[0-9]{2}[A-Z0-9]{13}$/.test(v), "The GSTIN should be 15 letters and numbers, like 24ABCDE1234F1Z5"),
  address: text(300),
  eventType: z.enum(EVENT_TYPES),
  eventName: text(120),
  hallId: z.string().min(1, "Please choose the hall"),
  eventDate: day("date of the function"),
  session: z.enum(SESSIONS),
  startTime: time("start"),
  endTime: time("end"),
  expectedPax: z.coerce.number().int().min(1, "Please type how many guests are expected").max(20000),
  guaranteedPax: z.coerce.number().int().min(0).max(20000).default(0),
  actualPax: z.coerce.number().int().min(0).max(20000).nullable().optional(),
  seating: z.enum(SEATING_STYLES).nullable().optional(),
  menuName: text(120),
  foodType: z.enum(FOOD_TYPES).default("veg"),
  menuItems: text(3000),
  platePrice: z.coerce.number().min(0, "The plate price cannot be less than 0").max(100000),
  foodGst: gst,
  hallRent: z.coerce.number().min(0, "The hall rent cannot be less than 0").max(10_000_000),
  hallGst: gst,
  discount: z.coerce.number().min(0, "The discount cannot be less than 0").default(0),
  requirements: text(3000),
  notes: text(2000),
  followUpOn: day("follow-up date").nullable().optional(),
});

export type BanquetFields = z.infer<typeof banquetFields>;

export const banquetItemSchema = z.object({
  category: z.enum(BANQUET_ITEM_CATEGORIES).default("other"),
  description: z.string().trim().min(1, "Please say what the item is").max(200),
  quantity: z.coerce.number().positive("Quantity must be more than zero").max(100000).default(1),
  unitPrice: z.coerce.number().min(0, "The price cannot be less than 0").max(10_000_000),
  gstRate: gst,
});

export const moneySchema = z.object({
  amount: z.coerce.number().positive("Amount must be more than zero"),
  method: z.enum(PAYMENT_METHODS),
  reference: text(100),
});

/** The fields saved on the function, with dates as database dates. */
export function banquetData(f: BanquetFields) {
  return {
    ...f,
    actualPax: f.actualPax ?? null,
    seating: f.seating ?? null,
    eventDate: dateFromKey(f.eventDate),
    followUpOn: f.followUpOn ? dateFromKey(f.followUpOn) : null,
  };
}
