// Shift reports: the maths and the WhatsApp text, shared by the server and the screens (no database here).
import { round2 } from "./pricing";
import { formatCurrency, label } from "./utils";

/** What a staff member did during one shift. Fixed when the shift ends. */
export interface ShiftSummary {
  checkIns: number;
  checkOuts: number;
  bookingsMade: number;
  paymentsCount: number;
  received: number; // money received from guests, after refunds (prepaid on booking sites not included)
  byMethod: Record<string, number>;
  cashExpenses: number; // cash this person paid out for expenses
  cashInHand: number; // cash received minus cash paid out
}

// Activity names written by the booking screens (see logActivity calls in the bookings API).
const CHECK_IN_ACTIONS = ["Guest checked in", "Walk-in checked in"];
const CHECK_OUT_ACTIONS = ["Guest checked out"];
const BOOKING_ACTIONS = ["New booking", "Walk-in checked in"];

// Letters and digits that cannot be mixed up when read off a screen (no 0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** The code a staff member types to end a shift, so it is never ended by a stray tap. */
export function shiftCode(length = 6, random: () => number = Math.random) {
  return Array.from({ length }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join("");
}

export function codeMatches(expected: string | null | undefined, typed: string) {
  return !!expected && typed.replace(/\s+/g, "").toUpperCase() === expected.toUpperCase();
}

/** Builds a summary from the shift's activity, payments and cash expenses. Pure, for tests. */
export function summarize(input: {
  actions: string[];
  payments: Array<{ amount: number; method: string; type: string }>;
  cashExpenses: number[];
}): ShiftSummary {
  const count = (names: string[]) => input.actions.filter((a) => names.includes(a)).length;
  const byMethod: Record<string, number> = {};
  for (const p of input.payments) {
    if (p.method === "ota") continue; // prepaid on a booking site: no money changed hands at the desk
    byMethod[p.method] = round2((byMethod[p.method] || 0) + (p.type === "refund" ? -p.amount : p.amount));
  }
  const received = round2(Object.values(byMethod).reduce((s, v) => s + v, 0));
  const cashExpenses = round2(input.cashExpenses.reduce((s, v) => s + v, 0));
  return {
    checkIns: count(CHECK_IN_ACTIONS),
    checkOuts: count(CHECK_OUT_ACTIONS),
    bookingsMade: count(BOOKING_ACTIONS),
    paymentsCount: input.payments.filter((p) => p.method !== "ota").length,
    received,
    byMethod,
    cashExpenses,
    cashInHand: round2((byMethod.cash || 0) - cashExpenses),
  };
}

export function durationLabel(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** The shift report the staff member sends to the owner on WhatsApp. */
export function shiftMessage(input: {
  hotelName: string;
  staffName: string;
  startedAt: Date | string;
  endedAt: Date | string;
  timeZone: string;
  summary: ShiftSummary;
  handoverNote: string;
  currency?: string;
}) {
  const { summary: s, timeZone, currency } = input;
  const time = (d: Date | string, withDay = true) =>
    new Intl.DateTimeFormat("en-IN", { ...(withDay && { day: "numeric", month: "short" }), hour: "numeric", minute: "2-digit", timeZone }).format(new Date(d));
  const day = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(d));
  const sameDay = day(input.startedAt) === day(input.endedAt);
  const money = (n: number) => formatCurrency(n, currency);
  const methods = Object.entries(s.byMethod)
    .filter(([, v]) => v !== 0)
    .map(([m, v]) => `${label(m)} ${money(v)}`)
    .join(" · ");
  return [
    `Shift report · ${input.hotelName}`,
    `Staff: ${input.staffName}`,
    `Shift: ${time(input.startedAt)} to ${time(input.endedAt, !sameDay)} (${durationLabel(new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime())})`,
    `Guest check-ins: ${s.checkIns}`,
    `Guest check-outs: ${s.checkOuts}`,
    `New bookings: ${s.bookingsMade}`,
    `Money received: ${money(s.received)}${methods ? ` (${methods})` : ""}`,
    s.cashExpenses ? `Cash paid for expenses: ${money(s.cashExpenses)}` : "",
    `Cash to hand over: ${money(s.cashInHand)}`,
    `Handover note: ${input.handoverNote}`,
  ]
    .filter(Boolean)
    .join("\n");
}
