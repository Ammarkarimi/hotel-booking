import { test } from "node:test";
import assert from "node:assert/strict";
import { daySheet, daySheetText, leavesText, nightsOf, type DaySheetBooking, type DaySheetData } from "../day-sheet";

const booking = (o: Partial<Omit<DaySheetBooking, "room">> & { room: string }): DaySheetBooking => ({
  number: 1,
  guestName: "Guest",
  guest: { phone: "9876500000" },
  adults: 1,
  children: 0,
  checkInDate: "2026-11-07",
  checkOutDate: "2026-11-09",
  folio: { balance: 0 },
  ...o,
  room: { roomNumber: o.room, type: "double" },
});

const data: DaySheetData = {
  today: "2026-11-08",
  hotelName: "Sunrise",
  stats: { collectedToday: 4500, owed: 1200 },
  inHouse: [
    booking({ room: "110", guestName: "Ravi Shah", checkOutDate: "2026-11-08", folio: { balance: 1200 } }),
    booking({ room: "9", guestName: "Asha Patel", checkOutDate: "2026-11-07" }),
    booking({ room: "102", guestName: "Meena Rao" }),
  ],
  arrivals: [booking({ room: "201", number: 42, guestName: "Kiran Das", checkInDate: "2026-11-08", checkOutDate: "2026-11-10" })],
  rooms: [
    { roomNumber: "12", type: "single", status: "available", housekeeping: "dirty", freeTonight: true, guestName: "Ravi Shah", arrivingGuest: null },
    { roomNumber: "3", type: "double", status: "available", housekeeping: "dirty", freeTonight: true, guestName: null, arrivingGuest: null },
    { roomNumber: "5", type: "double", status: "maintenance", housekeeping: "clean", freeTonight: false, guestName: null, arrivingGuest: null },
    { roomNumber: "110", type: "double", status: "occupied", housekeeping: "clean", freeTonight: false, guestName: "Ravi Shah", arrivingGuest: null },
  ],
};

test("guests and free rooms are listed by room number, broken rooms apart", () => {
  const s = daySheet(data);
  assert.deepEqual(s.staying.map((b) => b.room.roomNumber), ["9", "102", "110"]);
  assert.deepEqual(s.leavingToday.map((b) => b.room.roomNumber), ["9", "110"]);
  assert.deepEqual(s.free.map((r) => r.roomNumber), ["3", "12"]);
  assert.deepEqual(s.notUsable, ["5"]);
});

test("when a guest leaves is said plainly", () => {
  assert.equal(leavesText({ checkOutDate: "2026-11-08" }, "2026-11-08"), "Today");
  assert.match(leavesText({ checkOutDate: "2026-11-07" }, "2026-11-08"), /^Was due /);
  assert.equal(nightsOf({ checkInDate: "2026-11-08", checkOutDate: "2026-11-10" }), 2);
});

test("the WhatsApp message has every section", () => {
  const text = daySheetText(data, "10:30 am");
  assert.match(text, /^\*Sunrise: day sheet, .+\* \(10:30 am\)/);
  assert.match(text, /\*In the hotel \(3\)\*/);
  assert.match(text, /110 Ravi Shah, 9876500000, leaves today, due ₹1,200/);
  assert.match(text, /102 Meena Rao, 9876500000, leaves 9 Nov 2026$/m);
  assert.match(text, /9 Asha Patel, 9876500000, leaves was due 7 Nov 2026$/m);
  assert.match(text, /#42 Kiran Das, 9876500000, room 201, 2 nights/);
  assert.match(text, /\*Free tonight \(2\)\*\n3 Double \(needs cleaning\), 12 Single \(after check-out, needs cleaning\)/);
  assert.match(text, /Not usable: 5/);
  assert.match(text, /Received today: ₹4,500\nStill to collect: ₹1,200/);
});

test("an empty hotel still gives a readable message", () => {
  const text = daySheetText({ ...data, inHouse: [], arrivals: [], rooms: [] }, "9:00 am");
  assert.match(text, /No guests in\./);
  assert.match(text, /No arrivals\./);
  assert.match(text, /\*Free tonight \(0\)\*\nNone\./);
});
