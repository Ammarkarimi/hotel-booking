// Banquets (functions in the hotel's halls): the lists, the bill maths and the time checks.
// Pure, shared by the API, the screens and the tests (no database here).
import { round2, sumPayments } from "./pricing";

export const BANQUET_STATUSES = ["enquiry", "tentative", "confirmed", "completed", "cancelled"] as const;
export type BanquetStatus = (typeof BANQUET_STATUSES)[number];
/** These hold the hall: nobody else can be booked in it at the same time. An enquiry does not. */
export const HOLDING_STATUSES: BanquetStatus[] = ["tentative", "confirmed", "completed"];

export const EVENT_TYPES = ["wedding", "reception", "engagement", "sangeet_mehndi", "birthday", "anniversary", "corporate_event", "conference", "religious", "kitty_party", "other"] as const;
export const SESSIONS = ["breakfast", "lunch", "hi_tea", "dinner", "full_day"] as const;
/** Usual times for each session, filled in when it is chosen (staff can change them). */
export const SESSION_TIMES: Record<(typeof SESSIONS)[number], [string, string]> = {
  breakfast: ["08:00", "11:00"],
  lunch: ["12:00", "16:00"],
  hi_tea: ["16:00", "19:00"],
  dinner: ["19:00", "23:00"],
  full_day: ["09:00", "23:00"],
};
export const FOOD_TYPES = ["veg", "non_veg", "jain", "mixed"] as const;
export const SEATING_STYLES = ["round_tables", "theatre", "classroom", "u_shape", "cocktail", "floor_seating"] as const;
export const BANQUET_ITEM_CATEGORIES = [
  "extra_plates",
  "drinks",
  "decoration",
  "sound_dj",
  "lighting",
  "photography",
  "equipment",
  "extra_hours",
  "rooms",
  "damage",
  "other",
] as const;
/** Food and drinks take the food GST; everything else the services GST. */
export const FOOD_ITEM_CATEGORIES = ["extra_plates", "drinks"];

export interface BanquetBillInput {
  status?: string;
  expectedPax: number;
  guaranteedPax: number;
  actualPax: number | null;
  platePrice: number;
  foodGst: number;
  hallRent: number;
  hallGst: number;
  discount: number;
  items: Array<{ amount: number; gstRate: number }>;
  payments: Array<{ amount: number; type: string; status?: string }>;
}

export interface BanquetTaxLine {
  rate: number; // GST %
  taxable: number;
  tax: number; // CGST + SGST (or IGST)
}

export interface BanquetBill {
  billedPax: number; // plates charged: the plates served (or expected), but never fewer than guaranteed
  food: number;
  hall: number;
  extras: number;
  subtotal: number;
  discount: number;
  taxable: number;
  taxLines: BanquetTaxLine[];
  tax: number;
  total: number;
  paid: number;
  refunded: number;
  netPaid: number;
  balance: number;
}

/** Plates charged: what was served (or is expected, before the function), at least the guaranteed number. */
export function billedPlates(b: Pick<BanquetBillInput, "expectedPax" | "guaranteedPax" | "actualPax">) {
  return Math.max(b.actualPax ?? b.expectedPax, b.guaranteedPax || 0, 0);
}

/**
 * The function's bill. A discount is shared across the food, hall and extras in proportion to their
 * amounts, so each GST rate is charged on what is really billed at that rate.
 */
export function banquetBill(b: BanquetBillInput): BanquetBill {
  const billedPax = billedPlates(b);
  const food = round2(billedPax * (b.platePrice || 0));
  const hall = round2(b.hallRent || 0);
  const extras = round2(b.items.reduce((s, i) => s + i.amount, 0));
  const subtotal = round2(food + hall + extras);
  const discount = round2(Math.min(Math.max(0, b.discount || 0), subtotal));
  const share = subtotal > 0 ? (subtotal - discount) / subtotal : 0;

  const byRate = new Map<number, number>();
  const add = (rate: number, amount: number) => amount && byRate.set(rate, (byRate.get(rate) || 0) + amount);
  add(b.foodGst || 0, food);
  add(b.hallGst || 0, hall);
  for (const i of b.items) add(i.gstRate || 0, i.amount);
  const taxLines = [...byRate.entries()]
    .sort(([a], [c]) => a - c)
    .map(([rate, amount]) => {
      const taxable = round2(amount * share);
      return { rate, taxable, tax: round2((taxable * rate) / 100) };
    });
  const taxable = round2(subtotal - discount);
  const tax = round2(taxLines.reduce((s, l) => s + l.tax, 0));
  const total = round2(taxable + tax);
  const { paid, refunded, netPaid } = sumPayments(b.payments);
  // A cancelled function owes nothing more: what was kept is the cancellation charge.
  const balance = b.status === "cancelled" ? 0 : round2(total - netPaid);
  return { billedPax, food, hall, extras, subtotal, discount, taxable, taxLines, tax, total, paid, refunded, netPaid, balance };
}

/** Minutes since midnight for "HH:MM". */
export function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** A function's time on its day as [start, end) minutes; an end before the start runs past midnight. */
export function timeSpan(start: string, end: string): [number, number] {
  const s = minutesOf(start);
  let e = minutesOf(end);
  if (e <= s) e += 24 * 60;
  return [s, e];
}

/**
 * Do two functions in the same hall clash? Same day and overlapping times. A function running past
 * midnight also blocks the early hours of the next day.
 */
export function functionsClash(a: { date: string; start: string; end: string }, b: { date: string; start: string; end: string }) {
  const day = 24 * 60;
  const dayIndex = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86400000);
  const [as, ae] = timeSpan(a.start, a.end);
  const [bs, be] = timeSpan(b.start, b.end);
  const offset = (dayIndex(b.date) - dayIndex(a.date)) * day;
  return as < be + offset && bs + offset < ae;
}

export function banquetInvoiceNumber(prefix: string, number: number) {
  return `${prefix || "BQ"}-${number}`;
}
