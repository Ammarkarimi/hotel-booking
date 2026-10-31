import { test } from "node:test";
import assert from "node:assert/strict";
import { codeMatches, durationLabel, shiftCode, shiftMessage, summarize } from "../shift-report";

test("a shift counts check-ins, check-outs, bookings and the cash to hand over", () => {
  const s = summarize({
    actions: [
      { action: "Guest checked in", details: "#1021 for Asha Rao (Room 203)" },
      { action: "Walk-in checked in", details: "#1022 for Ravi Shah (Room 101), 2026-10-31 to 2026-11-01" },
      { action: "Guest checked out", details: "#1009 for John Smith (Room 401) — paid by card" },
      { action: "New booking", details: "#1023 for Meera Nair (Room 301), 2026-11-03 to 2026-11-05" },
      { action: "Payment received", details: "#1009: 4000 by cash" },
      { action: "Extra charge added", details: "#1021" },
    ],
    payments: [
      { amount: 4000, method: "cash", type: "balance" },
      { amount: 2500, method: "upi", type: "advance" },
      { amount: 500, method: "cash", type: "refund" },
      { amount: 9000, method: "ota", type: "balance" }, // prepaid on a booking site: not money at the desk
    ],
    cashExpenses: [300, 200],
  });
  assert.equal(s.checkIns, 2);
  assert.equal(s.checkOuts, 1);
  assert.equal(s.bookingsMade, 2); // a new booking and the walk-in
  assert.equal(s.paymentsCount, 3);
  assert.deepEqual(s.byMethod, { cash: 3500, upi: 2500 });
  assert.equal(s.received, 6000);
  assert.equal(s.cashExpenses, 500);
  assert.equal(s.cashInHand, 3000);
  assert.deepEqual(s.checkInList, ["#1021 for Asha Rao (Room 203)", "#1022 for Ravi Shah (Room 101)"]);
  assert.deepEqual(s.checkOutList, ["#1009 for John Smith (Room 401)"]);
});

test("the end-of-shift code avoids look-alike characters and is checked loosely", () => {
  for (let i = 0; i < 50; i++) assert.match(shiftCode(), /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(codeMatches("K7M2Q9", "k7m 2q9"), true);
  assert.equal(codeMatches("K7M2Q9", "K7M2Q8"), false);
  assert.equal(codeMatches(null, ""), false);
});

test("the WhatsApp shift report has the times, counts, money and note", () => {
  const text = shiftMessage({
    hotelName: "Sunrise Residency",
    staffName: "Pooja Verma",
    startedAt: "2026-10-31T03:30:00Z", // 9:00 am in India
    endedAt: "2026-10-31T12:15:00Z",
    timeZone: "Asia/Kolkata",
    currency: "INR",
    summary: summarize({ actions: [{ action: "Guest checked in" }, { action: "Guest checked out" }, { action: "Guest checked out" }], payments: [{ amount: 1500, method: "cash", type: "balance" }], cashExpenses: [] }),
    handoverNote: "Room 203 is staying 2 hours more and will pay ₹500.",
  });
  assert.match(text, /Staff: Pooja Verma/);
  assert.match(text, /Shift: 31 Oct, 9:00 am to 5:45 pm \(8h 45m\)/);
  assert.match(text, /Guest check-ins: 1\nGuest check-outs: 2/);
  assert.match(text, /Cash to hand over: ₹1,500/);
  assert.match(text, /Handover note: Room 203 is staying 2 hours more/);
  assert.equal(durationLabel(45 * 60000), "45m");
});
