// Rate tips: when rooms are still empty for tonight later in the day, suggest a lower price per
// room type so they get sold. The numbers come from the hotel's own bookings: how many rooms of
// each type are free tonight, and how many usually still get booked for the same night after
// this time of day. No database code here, so screens and tests can use it.
import { addDays, dateFromKey, diffDays, eachNight } from "./dates";
import { nightAdjustment, type PricingRules } from "./pricing";
import { clockLabel } from "./messages";

/** How far back the history goes. */
export const HISTORY_DAYS = 90;
/** Fewer days of bookings than this and the tips say so (they then rely on the time of day only). */
export const MIN_HISTORY_DAYS = 14;
/** The cut grows through the day: half of the biggest cut at first, then three quarters, then all of it. */
export const STAGES = [
  { key: "afternoon", afterHours: 0, share: 0.5 },
  { key: "evening", afterHours: 4, share: 0.75 },
  { key: "night", afterHours: 7, share: 1 },
] as const;
export type Stage = (typeof STAGES)[number]["key"];

const NOT_SOLD = new Set(["cancelled", "no_show"]);

export interface TipRoom {
  type: string;
  pricePerNight: number;
  status: string; // maintenance rooms cannot be sold
}

export interface TipBooking {
  roomType: string;
  checkIn: string; // date key
  checkOut: string;
  createdAt: Date | string;
  status: string;
  ratePerNight: number;
}

export interface TipSettings {
  from: string; // "13:00"
  maxDiscount: number; // %
  floors: Record<string, number>; // lowest price per night per room type
}

export interface RateTip {
  /** One price for one room type on one night. A lower price later is a new tip, so it pops up again. */
  key: string;
  date: string;
  type: string;
  free: number;
  sellable: number;
  /** How many more rooms of this type usually get booked for the same night from now on. */
  expected: number;
  usualPrice: number;
  price: number;
  discount: number; // % below the usual price, after rounding and the floor
  stage: Stage;
  floor: number | null;
  /** Rooms of this type booked after the start time for the same night, in the history. */
  lateSales: { count: number; averageRate: number | null };
  historyDays: number;
}

export interface TypeTonight {
  type: string;
  rooms: number;
  sellable: number;
  sold: number;
  free: number;
  expected: number;
  usualPrice: number;
  tip: RateTip | null;
  /** Why there is no tip, in words for the screen. */
  note: string;
}

const clocks = new Map<string, Intl.DateTimeFormat>();

/** The hotel's local date and minutes since midnight. */
export function localClock(at: Date | string, timeZone: string): { date: string; minutes: number } {
  let clock = clocks.get(timeZone);
  if (!clock) {
    clock = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    clocks.set(timeZone, clock);
  }
  const parts = clock.formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function minutesOf(hhmm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2])) : 13 * 60;
}

/** Prices are rounded up to ₹50 (₹10 under ₹500): a price someone would say, and never a bigger cut than allowed. */
export function roundPrice(n: number) {
  const step = n < 500 ? 10 : 50;
  return Math.max(0, Math.ceil(n / step) * step);
}

function median(list: number[]) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const sold = (b: TipBooking) => !NOT_SOLD.has(b.status);

/** The first day the hotel has bookings for, so days before it started using the software are not counted as empty. */
function firstDay(history: TipBooking[], timeZone: string) {
  let first: string | null = null;
  for (const b of history) {
    const made = localClock(b.createdAt, timeZone).date;
    const day = made < b.checkIn ? made : b.checkIn;
    if (!first || day < first) first = day;
  }
  return first;
}

/**
 * On a usual night like `night` (same weekday when there are enough of them), how many rooms of
 * `type` were booked on the day itself, at `fromMinutes` or later, for that same night.
 */
export function lateBookings(history: TipBooking[], type: string, night: string, fromMinutes: number, timeZone: string) {
  const start = firstDay(history, timeZone);
  const oldest = addDays(night, -HISTORY_DAYS);
  const from = start && start > oldest ? start : oldest;
  const days = start ? Math.max(0, diffDays(from, night)) : 0;
  const nights = Array.from({ length: days }, (_, i) => addDays(from, i));
  const weekday = dateFromKey(night).getUTCDay();
  const sameDay = nights.filter((n) => dateFromKey(n).getUTCDay() === weekday);
  // Saturdays are not Tuesdays: compare with the same weekday once there are 4 of them.
  const sample = sameDay.length >= 4 ? sameDay : nights;
  const inSample = new Set(sample);
  const late = history.filter((b) => {
    if (b.roomType !== type || !sold(b) || !inSample.has(b.checkIn)) return false;
    const made = localClock(b.createdAt, timeZone);
    return made.date === b.checkIn && made.minutes >= fromMinutes;
  });
  const rates = late.map((b) => b.ratePerNight).filter((r) => r > 0);
  return {
    perNight: sample.length ? late.length / sample.length : 0,
    count: late.length,
    averageRate: rates.length ? Math.round(rates.reduce((a, r) => a + r, 0) / rates.length) : null,
    historyDays: days,
    sameWeekday: sample === sameDay,
  };
}

/** Rooms of each type for tonight, and a lower price for the ones that will probably stay empty. */
export function tonightByType(o: {
  now: Date;
  timeZone: string;
  rooms: TipRoom[];
  bookings: TipBooking[]; // every booking that could cover tonight (and the history)
  rules: PricingRules;
  settings: TipSettings;
}): { date: string; minutes: number; started: boolean; types: TypeTonight[] } {
  const { date, minutes } = localClock(o.now, o.timeZone);
  const from = minutesOf(o.settings.from);
  const started = minutes >= from;
  const stageIndex = started ? STAGES.reduce((at, s, i) => (minutes - from >= s.afterHours * 60 ? i : at), 0) : -1;
  const history = o.bookings.filter((b) => b.checkIn < date);
  const types = [...new Set(o.rooms.map((r) => r.type))];

  const result = types.map((type): TypeTonight => {
    const rooms = o.rooms.filter((r) => r.type === type);
    const sellable = rooms.filter((r) => r.status !== "maintenance");
    const taken = o.bookings.filter((b) => b.roomType === type && sold(b) && b.status !== "checked_out" && b.checkIn <= date && b.checkOut > date).length;
    const free = Math.max(0, sellable.length - taken);
    const usualPrice = Math.round(median(sellable.map((r) => r.pricePerNight)) * (1 + nightAdjustment(date, type, o.rules) / 100));
    const late = lateBookings(history, type, date, minutes, o.timeZone);
    const expected = Math.round(late.perNight * 10) / 10;
    const base = { type, rooms: rooms.length, sellable: sellable.length, sold: Math.min(taken, sellable.length), free, expected, usualPrice, tip: null };

    if (sellable.length === 0) return { ...base, note: "No room of this type can be sold tonight." };
    if (free === 0) return { ...base, note: "Sold out tonight." };
    if (!started) return { ...base, note: `Tips start at ${clockLabel(o.settings.from)}. Mornings sell at the usual price.` };
    // Rooms that usually still get booked from now on are left at the usual price.
    const empty = free - expected;
    if (empty < 0.5) return { ...base, note: `About ${formatCount(expected)} more usually get booked for tonight from now on. Keep the usual price.` };

    // Very empty (half or more of the type still free): one step further.
    const veryEmpty = free / sellable.length >= 0.5;
    const stage = STAGES[Math.min(STAGES.length - 1, stageIndex + (veryEmpty ? 1 : 0))];
    const floor = o.settings.floors[type] > 0 ? o.settings.floors[type] : null;
    let price = roundPrice(usualPrice * (1 - (o.settings.maxDiscount * stage.share) / 100));
    if (floor !== null) price = Math.max(price, floor);
    if (!(price < usualPrice) || o.settings.maxDiscount <= 0) {
      return { ...base, note: floor !== null ? "Your lowest price for this type is the usual price." : "Keep the usual price." };
    }
    const tip: RateTip = {
      key: `${date}|${type}|${price}`,
      date,
      type,
      free,
      sellable: sellable.length,
      expected,
      usualPrice,
      price,
      discount: Math.round((1 - price / usualPrice) * 100),
      stage: stage.key,
      floor,
      lateSales: { count: late.count, averageRate: late.averageRate },
      historyDays: late.historyDays,
    };
    return { ...base, tip, note: "" };
  });
  return { date, minutes, started, types: result.sort((a, b) => a.usualPrice - b.usualPrice) };
}

function formatCount(n: number) {
  return n >= 1 ? String(Math.round(n)) : "1";
}

/** Time slots for "when do bookings come in". */
export const SLOTS = [
  { key: "early", label: "Before 9 am", from: 0, to: 9 },
  { key: "morning", label: "9 am – 12 noon", from: 9, to: 12 },
  { key: "midday", label: "12 – 3 pm", from: 12, to: 15 },
  { key: "afternoon", label: "3 – 6 pm", from: 15, to: 18 },
  { key: "evening", label: "6 – 9 pm", from: 18, to: 21 },
  { key: "late", label: "After 9 pm", from: 21, to: 24 },
] as const;

export interface TypeInsight {
  type: string;
  rooms: number;
  roomNights: number;
  soldNights: number;
  occupancy: number; // %
  emptyNights: number;
  averageRate: number | null;
  listPrice: number;
}

/**
 * The last `days` nights before `today`: how full each room type was, at what price, and at
 * what time of day bookings were made (all bookings, and those made for the same night).
 */
export function salesInsights(o: { today: string; days: number; timeZone: string; rooms: TipRoom[]; bookings: TipBooking[] }) {
  const start = addDays(o.today, -o.days);
  const nights = new Set(Array.from({ length: o.days }, (_, i) => addDays(start, i)));
  const first = firstDay(o.bookings, o.timeZone);
  const counted = [...nights].filter((n) => !first || n >= first).length;
  const types = [...new Set(o.rooms.map((r) => r.type))];

  const byType: TypeInsight[] = types.map((type) => {
    const rooms = o.rooms.filter((r) => r.type === type);
    let soldNights = 0;
    let money = 0;
    for (const b of o.bookings) {
      if (b.roomType !== type || !sold(b)) continue;
      for (const n of eachNight(b.checkIn, b.checkOut)) {
        if (!nights.has(n) || (first && n < first)) continue;
        soldNights += 1;
        money += b.ratePerNight;
      }
    }
    const roomNights = rooms.length * counted;
    soldNights = Math.min(soldNights, roomNights);
    return {
      type,
      rooms: rooms.length,
      roomNights,
      soldNights,
      occupancy: roomNights ? Math.round((soldNights / roomNights) * 100) : 0,
      emptyNights: roomNights - soldNights,
      averageRate: soldNights ? Math.round(money / soldNights) : null,
      listPrice: Math.round(median(rooms.map((r) => r.pricePerNight))),
    };
  });

  const slot = (minutes: number) => SLOTS.findIndex((s) => minutes >= s.from * 60 && minutes < s.to * 60);
  const all = SLOTS.map(() => 0);
  const sameDay = SLOTS.map(() => 0);
  for (const b of o.bookings) {
    if (!sold(b)) continue;
    const made = localClock(b.createdAt, o.timeZone);
    if (made.date < start || made.date >= o.today) continue;
    all[slot(made.minutes)] += 1;
    if (made.date === b.checkIn) sameDay[slot(made.minutes)] += 1;
  }
  return {
    from: start,
    days: counted,
    byType: byType.sort((a, b) => a.listPrice - b.listPrice),
    slots: SLOTS.map((s, i) => ({ key: s.key, label: s.label, all: all[i], sameDay: sameDay[i] })),
  };
}

export function parseFloors(raw: string | null | undefined): Record<string, number> {
  try {
    const v = JSON.parse(raw || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === "number" && n > 0)) as Record<string, number>;
  } catch {
    return {};
  }
}

/** What a person must type to close the tips. */
export const SEEN_TEXT = "I have seen";
export function isSeenText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase() === SEEN_TEXT.toLowerCase();
}
