import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingMessage, clockLabel, DEFAULT_MESSAGES, fillMessage, messageKindFor, messageValues } from "../messages";

const booking = {
  guestName: "Asha Rao",
  number: 1022,
  adults: 2,
  children: 1,
  checkInDate: "2026-11-03",
  checkOutDate: "2026-11-05",
  actualCheckIn: "2026-11-03T09:05:00Z", // 2:35 pm in India
  actualCheckOut: null,
  room: { roomNumber: "204", type: "deluxe" },
  folio: { grandTotal: 10080, netPaid: 2000, balance: 8080, nightCount: 2 },
  bill: null,
};
const hotel = { hotelName: "Sunrise Residency", checkInTime: "12:00", checkOutTime: "11:00", phone: "+91 98765 43210", currency: "INR", timezone: "Asia/Kolkata" };

test("the welcome message starts with Welcome to the hotel, has both times, and ends with thanks", () => {
  const text = bookingMessage("checkIn", booking, hotel);
  const lines = text.split("\n");
  assert.equal(lines[0], "Welcome to Sunrise Residency, Asha Rao!");
  assert.equal(lines.at(-1), "Thank you for staying at Sunrise Residency!");
  assert.match(text, /Room: 204 \(Deluxe\)/);
  assert.match(text, /Guests: 2 adults, 1 child/);
  assert.match(text, /Checked in: 3 Nov 2026, 2:35 pm/);
  assert.match(text, /Check-out: 5 Nov 2026 by 11:00 am/);
  assert.match(text, /Balance: ₹8,080/);
  assert.match(text, /call the front desk on \+91 98765 43210/);
});

test("the booking confirmation names the room type, not the room number", () => {
  const text = bookingMessage("booking", booking, hotel);
  assert.match(text, /Room: Deluxe room/);
  assert.doesNotMatch(text, /204/);
  assert.match(text, /check-in from 12:00 pm/);
});

test("the owner's own wording is used, and lines with nothing to show are left out", () => {
  const own = "Hi {guest}!\nInvoice: {invoice_no}\n\n\nLeave by {check_out_time}.\nUnknown {wifi} stays as typed.";
  assert.equal(bookingMessage("checkIn", booking, { ...hotel, messages: { checkIn: own } }), "Hi Asha Rao!\n\nLeave by 11:00 am.\nUnknown {wifi} stays as typed.");
  // An empty custom message falls back to the default.
  assert.equal(bookingMessage("checkIn", booking, { ...hotel, messages: { checkIn: "  " } }), fillMessage(DEFAULT_MESSAGES.checkIn, messageValues(booking, hotel)));
  // No phone saved: the line asking to call is dropped.
  assert.doesNotMatch(bookingMessage("checkIn", booking, { ...hotel, phone: null }), /call the front desk/);
});

test("the right message for each stage, and clock times", () => {
  assert.equal(messageKindFor("reserved"), "booking");
  assert.equal(messageKindFor("checked_in"), "checkIn");
  assert.equal(messageKindFor("checked_out"), "checkOut");
  assert.equal(clockLabel("12:00"), "12:00 pm");
  assert.equal(clockLabel("00:30"), "12:30 am");
  assert.equal(clockLabel("14:05"), "2:05 pm");
  const out = bookingMessage("checkOut", { ...booking, actualCheckOut: "2026-11-05T05:00:00Z", bill: { invoiceNumber: "INV-1022" }, folio: { ...booking.folio, netPaid: 10080, balance: 0 } }, hotel);
  assert.match(out, /^Dear Asha Rao,\nYou have checked out of Sunrise Residency\./);
  assert.match(out, /Invoice: INV-1022/);
  assert.match(out, /Stay: 3 Nov 2026 to 5 Nov 2026 \(2 nights\)/);
  assert.match(out, /Checked out: 5 Nov 2026, 10:30 am/);
  assert.match(out, /Balance: ₹0/);
});

test("the payment link line shows only when the hotel takes online payments and money is still due", () => {
  const withToken = { ...booking, publicToken: "tok123" };
  const online = { ...hotel, onlinePayments: true, siteUrl: "https://innvela.example/" };
  assert.match(bookingMessage("booking", withToken, online), /Pay online: https:\/\/innvela\.example\/pay\/tok123/);
  assert.doesNotMatch(bookingMessage("booking", withToken, hotel), /Pay online/);
  const paid = { ...withToken, folio: { ...withToken.folio, netPaid: 10080, balance: 0 } };
  assert.doesNotMatch(bookingMessage("booking", paid, online), /Pay online/);
});

test("a group's message is about every room and the group's totals", () => {
  const group = {
    groupId: "g1",
    adults: 5,
    children: 1,
    total: 20000,
    paid: 5000,
    balance: 15000,
    rooms: [
      { id: "a", number: 1022, roomNumber: "204", roomType: "deluxe", status: "reserved", adults: 2, children: 1, total: 10080, paid: 5000, balance: 5080, invoiceNumber: null },
      { id: "b", number: 1023, roomNumber: "205", roomType: "deluxe", status: "reserved", adults: 2, children: 0, total: 6000, paid: 0, balance: 6000, invoiceNumber: null },
      { id: "c", number: 1024, roomNumber: "301", roomType: "double", status: "reserved", adults: 1, children: 0, total: 3920, paid: 0, balance: 3920, invoiceNumber: null },
    ],
  };
  const text = bookingMessage("booking", { ...booking, group }, hotel);
  assert.match(text, /Room: 2 Deluxe, 1 Double rooms/);
  assert.match(text, /Guests: 5 adults, 1 child/);
  assert.match(text, /Total: ₹20,000/);
  assert.match(text, /Balance to pay: ₹15,000/);
  assert.match(bookingMessage("checkIn", { ...booking, group }, hotel), /Room: 204, 205, 301 \(2 Deluxe, 1 Double\)/);
});

test("the check-out message asks for a review only when the hotel has a review link", () => {
  const out = { ...booking, actualCheckOut: "2026-11-12T05:00:00.000Z" };
  assert.match(bookingMessage("checkOut", out, { ...hotel, reviewLink: "https://g.page/r/abc/review" }), /a short review helps us a lot: https:\/\/g\.page\/r\/abc\/review/);
  assert.doesNotMatch(bookingMessage("checkOut", out, hotel), /review/);
});
