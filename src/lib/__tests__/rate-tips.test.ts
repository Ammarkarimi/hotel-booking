import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../dates";
import { isSeenText, lateBookings, localClock, parseFloors, roundPrice, salesInsights, tonightByType, type TipBooking } from "../rate-tips";

const tz = "Asia/Kolkata";
const tonight = "2026-11-03"; // a Tuesday
const rules = { weekendSurcharge: 0, seasonalRates: [] };
const settings = { from: "13:00", maxDiscount: 20, floors: {} as Record<string, number> };
const rooms = [
  { type: "deluxe", pricePerNight: 2800, status: "available" },
  { type: "deluxe", pricePerNight: 2800, status: "occupied" },
  { type: "deluxe", pricePerNight: 2800, status: "available" },
  { type: "deluxe", pricePerNight: 2800, status: "maintenance" },
  { type: "suite", pricePerNight: 5000, status: "available" },
  { type: "suite", pricePerNight: 5000, status: "available" },
];
// One deluxe room is booked for tonight.
const tonightBooking: TipBooking = { roomType: "deluxe", checkIn: tonight, checkOut: addDays(tonight, 1), createdAt: "2026-11-01T06:00:00Z", status: "reserved", ratePerNight: 2800 };
/** For each of the last 4 weeks: `perDay` deluxe rooms booked at 3 pm for the same night. */
function history(perDay: number): TipBooking[] {
  const list: TipBooking[] = [];
  for (let d = 1; d <= 28; d++) {
    const night = addDays(tonight, -d);
    for (let i = 0; i < perDay; i++) list.push({ roomType: "deluxe", checkIn: night, checkOut: addDays(night, 1), createdAt: `${night}T09:30:00Z`, status: "checked_out", ratePerNight: 2400 });
  }
  return list;
}
const at = (ist: string) => new Date(`${tonight}T${ist}:00+05:30`);

test("the hotel's own clock, prices people would say, and the words that close the tips", () => {
  assert.deepEqual(localClock("2026-11-03T08:00:00Z", tz), { date: "2026-11-03", minutes: 13 * 60 + 30 });
  assert.deepEqual(localClock("2026-11-03T20:00:00Z", tz), { date: "2026-11-04", minutes: 90 });
  assert.equal(roundPrice(2380), 2400);
  assert.equal(roundPrice(2240), 2250);
  assert.equal(roundPrice(476), 480);
  assert.equal(isSeenText("  i HAVE   seen "), true);
  assert.equal(isSeenText("I have"), false);
  assert.deepEqual(parseFloors('{"deluxe":2000,"suite":0,"x":"y"}'), { deluxe: 2000 });
  assert.deepEqual(parseFloors("oops"), {});
});

test("how many rooms usually still get booked for the same night after this time", () => {
  const late = lateBookings(history(1), "deluxe", tonight, 13 * 60, tz);
  assert.equal(late.sameWeekday, true); // 4 Tuesdays in the last 4 weeks
  assert.equal(late.perNight, 1);
  assert.equal(late.averageRate, 2400);
  // Booked at 3 pm: nothing comes in after 4 pm.
  assert.equal(lateBookings(history(1), "deluxe", tonight, 16 * 60, tz).perNight, 0);
});

test("no tips in the morning; in the afternoon a lower price for rooms that will probably stay empty", () => {
  const bookings = [tonightBooking, ...history(1)];
  const morning = tonightByType({ now: at("11:00"), timeZone: tz, rooms, bookings, rules, settings });
  assert.equal(morning.started, false);
  assert.ok(morning.types.every((t) => t.tip === null));
  assert.match(morning.types[0].note, /Tips start at 1:00 pm/);

  const afternoon = tonightByType({ now: at("13:30"), timeZone: tz, rooms, bookings, rules, settings });
  const deluxe = afternoon.types.find((t) => t.type === "deluxe")!;
  assert.deepEqual([deluxe.sellable, deluxe.sold, deluxe.free, deluxe.expected], [3, 1, 2, 1]);
  // 2 free, about 1 more usually sells: 1 will probably stay empty. Very empty (2 of 3), so 15% off, rounded up to ₹50.
  assert.equal(deluxe.tip?.price, 2400);
  assert.equal(deluxe.tip?.discount, 14);
  assert.equal(deluxe.tip?.key, "2026-11-03|deluxe|2400");
  assert.equal(deluxe.tip?.stage, "evening");
  assert.deepEqual(deluxe.tip?.lateSales, { count: 4, averageRate: 2400 });

  // At 4 pm nothing more usually comes in, but the reason still counts the 4 rooms booked after 1 pm.
  const four = tonightByType({ now: at("16:00"), timeZone: tz, rooms, bookings, rules, settings }).types.find((t) => t.type === "deluxe")!;
  assert.equal(four.expected, 0);
  assert.deepEqual(four.tip?.lateSales, { count: 4, averageRate: 2400 });

  // Later at night the cut is the biggest allowed (20%), so the tip is new.
  const night = tonightByType({ now: at("21:00"), timeZone: tz, rooms, bookings, rules, settings });
  assert.equal(night.types.find((t) => t.type === "deluxe")!.tip?.price, 2250);

  // The owner's lowest price is never crossed.
  const floored = tonightByType({ now: at("21:00"), timeZone: tz, rooms, bookings, rules, settings: { ...settings, floors: { suite: 4500 } } });
  const suite = floored.types.find((t) => t.type === "suite")!;
  assert.equal(suite.tip?.price, 4500);
  assert.equal(suite.tip?.discount, 10);
  const noCut = tonightByType({ now: at("21:00"), timeZone: tz, rooms, bookings, rules, settings: { ...settings, floors: { suite: 5000 } } });
  assert.equal(noCut.types.find((t) => t.type === "suite")!.tip, null);
});

test("no tip when the free rooms usually sell anyway, or when the type is sold out", () => {
  const busy = tonightByType({ now: at("13:30"), timeZone: tz, rooms, bookings: [tonightBooking, ...history(2)], rules, settings });
  const deluxe = busy.types.find((t) => t.type === "deluxe")!;
  assert.equal(deluxe.tip, null);
  assert.match(deluxe.note, /About 2 more usually get booked/);

  const full = [tonightBooking, { ...tonightBooking }, { ...tonightBooking }];
  const soldOut = tonightByType({ now: at("15:00"), timeZone: tz, rooms, bookings: full, rules, settings });
  assert.equal(soldOut.types.find((t) => t.type === "deluxe")!.note, "Sold out tonight.");
  // Cancelled bookings do not fill rooms.
  const cancelled = tonightByType({ now: at("15:00"), timeZone: tz, rooms, bookings: full.map((b) => ({ ...b, status: "cancelled" })), rules, settings });
  assert.equal(cancelled.types.find((t) => t.type === "deluxe")!.free, 3);
});

test("sales by room type and the time of day bookings come in", () => {
  const s = salesInsights({ today: tonight, days: 28, timeZone: tz, rooms, bookings: history(1) });
  const deluxe = s.byType.find((t) => t.type === "deluxe")!;
  assert.deepEqual([deluxe.rooms, deluxe.roomNights, deluxe.soldNights, deluxe.occupancy, deluxe.averageRate], [4, 112, 28, 25, 2400]);
  assert.equal(s.byType.find((t) => t.type === "suite")!.occupancy, 0);
  const afternoon = s.slots.find((x) => x.key === "afternoon")!;
  assert.deepEqual([afternoon.all, afternoon.sameDay], [28, 28]);
});
