import { test } from "node:test";
import assert from "node:assert/strict";
import { blockStays, buildIcal, checkFeedUrl, classifyEvent, isPrivateAddress, parseIcal } from "../ical";

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;

test("an Airbnb calendar: a reservation with its code, and a plain block", () => {
  const text = [
    "BEGIN:VCALENDAR",
    "PRODID;X-RICAL-TZSOURCE=TZINFO:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
    "CALSCALE:GREGORIAN",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "DTEND;VALUE=DATE:20261115",
    "DTSTART;VALUE=DATE:20261112",
    "UID:1418fb94e984-7c2f@airbnb.com",
    "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/",
    " details/HMABCD1234\\nPhone Number (Last 4 Digits): 6789",
    "SUMMARY:Reserved",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTEND;VALUE=DATE:20261203",
    "DTSTART;VALUE=DATE:20261201",
    "UID:7f662ec65913-aaaa@airbnb.com",
    "SUMMARY:Airbnb (Not available)",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const { valid, events } = parseIcal(text);
  assert.equal(valid, true);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], {
    uid: "1418fb94e984-7c2f@airbnb.com",
    start: "2026-11-12",
    end: "2026-11-15",
    summary: "Reserved",
    description: "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCD1234\nPhone Number (Last 4 Digits): 6789",
    status: "",
  });
  const sold = classifyEvent(events[0], "airbnb");
  assert.equal(sold.kind, "reservation");
  assert.equal(sold.otaReference, "HMABCD1234");
  assert.deepEqual(sold.guest, { firstName: "Airbnb", lastName: "guest" });
  assert.match(sold.notes ?? "", /6789/);
  assert.equal(classifyEvent(events[1], "airbnb").kind, "block");
});

test("dates: whole days, UTC times, times with a zone, no end, a length, LF line ends and folded lines", () => {
  const text = wrap(
    [
      "BEGIN:VEVENT\nUID:a\nDTSTART:20261112T140000Z\nDTEND:20261114T050000Z\nSUMMARY:Reserved\nEND:VEVENT",
      "BEGIN:VEVENT\nUID:b\nDTSTART;TZID=Asia/Kolkata:20261112T140000\nDTEND;TZID=Asia/Kolkata:20261113T110000\nSUMMARY:Asha\n  Rao\nEND:VEVENT",
      "BEGIN:VEVENT\nUID:c\nDTSTART;VALUE=DATE:20261120\nSUMMARY:Blocked\nEND:VEVENT",
      "BEGIN:VEVENT\nUID:d\nDTSTART;VALUE=DATE:20261120\nDURATION:P3D\nSUMMARY:Booked\nEND:VEVENT",
      "BEGIN:VEVENT\nUID:e\nDTSTART:20261112T100000\nDTEND:20261112T120000\nSUMMARY:Same day\nEND:VEVENT",
      "BEGIN:VEVENT\nUID:f\nDTSTART;VALUE=DATE:20261125\nDTEND;VALUE=DATE:20261127\nSTATUS:CANCELLED\nSUMMARY:Reserved\nEND:VEVENT",
      "BEGIN:VEVENT\nUID:g\nSUMMARY:No date\nEND:VEVENT",
    ].join("\n")
  ).replace(/\r\n/g, "\n");
  const { valid, events } = parseIcal(text);
  assert.equal(valid, true);
  assert.deepEqual(
    events.map((e) => [e.uid, e.start, e.end]),
    [
      ["a", "2026-11-12", "2026-11-14"],
      ["b", "2026-11-12", "2026-11-13"],
      ["c", "2026-11-20", "2026-11-21"],
      ["d", "2026-11-20", "2026-11-23"],
      ["e", "2026-11-12", "2026-11-13"],
    ]
  );
  assert.equal(events[1].summary, "Asha Rao");
});

test("a time written in UTC becomes the hotel's own day when its time zone is given", () => {
  const text = wrap("BEGIN:VEVENT\r\nUID:a\r\nDTSTART:20261112T200000Z\r\nDTEND:20261114T200000Z\r\nSUMMARY:Reserved\r\nEND:VEVENT");
  assert.deepEqual(parseIcal(text).events.map((e) => [e.start, e.end]), [["2026-11-12", "2026-11-14"]]);
  // 20:00 UTC is 01:30 the next morning in India.
  assert.deepEqual(parseIcal(text, { timeZone: "Asia/Kolkata" }).events.map((e) => [e.start, e.end]), [["2026-11-13", "2026-11-15"]]);
});

test("escaped text, quoted parameters, alarms inside an event, and events without an ID", () => {
  const text = wrap(
    [
      'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261112\r\nDTEND;VALUE=DATE:20261113\r\nSUMMARY;LANGUAGE=en;X-NOTE="a:b;c":Reserved - Rao\\, Asha\; VIP \\\\ late\r\nDESCRIPTION:Line 1\\nLine 2\\NLine 3',
      "BEGIN:VALARM\r\nDESCRIPTION:Reminder\r\nSUMMARY:Alarm\r\nEND:VALARM\r\nEND:VEVENT",
      "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261112\r\nDTEND;VALUE=DATE:20261113\r\nSUMMARY:Reserved - Rao\\, Asha\; VIP \\\\ late\r\nEND:VEVENT",
      "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261112\r\nDTEND;VALUE=DATE:20261114\r\nSUMMARY:Blocked\r\nEND:VEVENT",
    ].join("\r\n")
  );
  const { events } = parseIcal(text);
  assert.equal(events.length, 3);
  assert.equal(events[0].summary, "Reserved - Rao, Asha; VIP \\ late");
  assert.equal(events[0].description, "Line 1\nLine 2\nLine 3");
  // The same stay gets the same made-up ID every time; a different stay gets another.
  assert.equal(events[0].uid, events[1].uid);
  assert.notEqual(events[0].uid, events[2].uid);
  assert.equal(parseIcal(text).events[2].uid, events[2].uid);
});

test("a page that is not a calendar is refused", () => {
  assert.equal(parseIcal("<html><body>Please sign in</body></html>").valid, false);
  assert.equal(parseIcal("").valid, false);
  assert.equal(parseIcal("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART;VALUE=DATE:20261112").valid, false);
  // A calendar with nothing in it is still a calendar.
  assert.deepEqual(parseIcal("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR"), { valid: true, events: [] });
});

test("our own calendar: correct form, folded lines, and it reads back the same", () => {
  const long = "Booked, by a guest; with a very long note that goes on well past seventy-five bytes — ₹ and हिंदी too";
  const events = [
    { uid: "booking-abc@innvela", start: "2026-11-12", end: "2026-11-15", summary: "Booked" },
    { uid: "booking-def@innvela", start: "2026-12-30", end: "2027-01-02", summary: long, description: "Line 1\nLine 2" },
  ];
  const text = buildIcal({ name: "Sunrise Hotel - Room 101, garden side", events, now: new Date("2026-11-11T10:20:30Z") });
  assert.ok(text.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
  assert.equal(text.replace(/\r\n/g, "").includes("\n"), false, "every line ends with CRLF");
  for (const need of ["PRODID:", "VERSION:2.0", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Sunrise Hotel - Room 101\\, garden side", "DTSTAMP:20261111T102030Z", "DTSTART;VALUE=DATE:20261112", "DTEND;VALUE=DATE:20261115"]) {
    assert.ok(text.includes(need), need);
  }
  const lines = text.split("\r\n");
  for (const line of lines) assert.ok(Buffer.byteLength(line, "utf8") <= 75, `too long: ${line}`);
  assert.ok(lines.some((l) => l.startsWith(" ")), "the long line is folded");

  const back = parseIcal(text);
  assert.equal(back.valid, true);
  assert.deepEqual(
    back.events.map((e) => ({ uid: e.uid, start: e.start, end: e.end, summary: e.summary })),
    events.map((e) => ({ uid: e.uid, start: e.start, end: e.end, summary: e.summary }))
  );
  assert.equal(back.events[1].description, "Line 1\nLine 2");
});

test("reservation or plain block?", () => {
  const kind = (summary: string, description = "") => classifyEvent({ summary, description }, "booking_com").kind;
  for (const s of ["Airbnb (Not available)", "CLOSED - Not available", "Blocked", "Unavailable", "Not available", "", "Airbnb", "Closed"]) assert.equal(kind(s), "block", s);
  for (const s of ["Reserved", "Booked", "Reservation", "John Smith", "Reserved - John Smith", "Booking.com reservation"]) assert.equal(kind(s), "reservation", s);

  assert.deepEqual(classifyEvent({ summary: "Reserved - John Smith" }, "other").guest, { firstName: "John", lastName: "Smith" });
  assert.deepEqual(classifyEvent({ summary: "Asha Rao (2 guests)" }, "agoda").guest, { firstName: "Asha", lastName: "Rao" });
  assert.deepEqual(classifyEvent({ summary: "Booked" }, "agoda").guest, { firstName: "Agoda", lastName: "guest" });
  // A block never carries a guest or a booking number.
  const block = classifyEvent({ summary: "CLOSED - Not available", description: "Booking ID: 12345678" }, "booking_com");
  assert.deepEqual([block.guest.firstName, block.guest.lastName, block.otaReference, block.notes], ["Booking.com", "guest", null, null]);
  assert.equal(classifyEvent({ summary: "Reserved", description: "Booking ID: 4411223344" }, "agoda").otaReference, "4411223344");
});

const takenOn = (...nights: string[]) => (night: string) => nights.includes(night);

test("echo rule: a block that only repeats our own bookings is ignored", () => {
  const event = { start: "2026-11-12", end: "2026-11-15" };
  assert.deepEqual(blockStays({ event, refBase: "ical:c:u", today: "2026-11-11", taken: takenOn("2026-11-12", "2026-11-13", "2026-11-14") }), []);
});

test("echo rule: one long block is cut around our own nights, each run its own stay", () => {
  const stays = blockStays({ event: { start: "2026-11-12", end: "2026-11-20" }, refBase: "ical:c:u", today: "2026-11-11", taken: takenOn("2026-11-14", "2026-11-15", "2026-11-19") });
  assert.deepEqual(stays, [
    { ref: "ical:c:u:2026-11-12", checkIn: "2026-11-12", checkOut: "2026-11-14" },
    { ref: "ical:c:u:2026-11-16", checkIn: "2026-11-16", checkOut: "2026-11-19" },
  ]);
  // Nothing of ours in it: the whole block is one stay.
  assert.deepEqual(blockStays({ event: { start: "2026-11-12", end: "2026-11-14" }, refBase: "ical:c:u", today: "2026-11-11", taken: () => false }), [
    { ref: "ical:c:u:2026-11-12", checkIn: "2026-11-12", checkOut: "2026-11-14" },
  ]);
});

test("echo rule: nights before today are never written, and a stay keeps its ref from day to day", () => {
  const event = { start: "2026-11-01", end: "2026-11-20" };
  const first = blockStays({ event, refBase: "ical:c:u", today: "2026-11-11", taken: () => false });
  assert.deepEqual(first, [{ ref: "ical:c:u:2026-11-11", checkIn: "2026-11-11", checkOut: "2026-11-20" }]);
  // Two days later the same block is still the same stay, with the arrival date it had.
  assert.deepEqual(blockStays({ event, refBase: "ical:c:u", today: "2026-11-13", taken: () => false, known: first }), first);
  // A block that grew at the front (our own booking before it was cancelled) is still the same stay, now longer.
  const known = [{ ref: "ical:c:u:2026-11-14", checkIn: "2026-11-14", checkOut: "2026-11-20" }];
  assert.deepEqual(blockStays({ event: { start: "2026-11-12", end: "2026-11-20" }, refBase: "ical:c:u", today: "2026-11-11", taken: () => false, known }), [
    { ref: "ical:c:u:2026-11-14", checkIn: "2026-11-12", checkOut: "2026-11-20" },
  ]);
  // Stays of another event are never taken over.
  const other = [{ ref: "ical:c:other:2026-11-12", checkIn: "2026-11-12", checkOut: "2026-11-20" }];
  assert.equal(blockStays({ event: { start: "2026-11-12", end: "2026-11-20" }, refBase: "ical:c:u", today: "2026-11-11", taken: () => false, known: other })[0].ref, "ical:c:u:2026-11-12");
});

test("links into a private network are refused", () => {
  for (const bad of [
    "http://localhost/cal.ics",
    "http://intranet/cal.ics",
    "http://127.0.0.1/cal.ics",
    "http://2130706433/cal.ics",
    "http://10.1.2.3/cal.ics",
    "http://172.20.0.1/cal.ics",
    "http://192.168.1.10:8080/cal.ics",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/cal.ics",
    "http://[fd00::1]/cal.ics",
    "http://[fe80::1]/cal.ics",
    "http://[::ffff:127.0.0.1]/cal.ics",
    "http://printer.local/cal.ics",
    "ftp://example.com/cal.ics",
    "file:///etc/passwd",
    "https://user:pass@example.com/cal.ics",
    "not a link",
  ]) {
    assert.equal(checkFeedUrl(bad).ok, false, bad);
  }
  assert.deepEqual(checkFeedUrl(" https://www.airbnb.com/calendar/ical/123.ics?s=abc "), { ok: true, url: "https://www.airbnb.com/calendar/ical/123.ics?s=abc" });
  assert.deepEqual(checkFeedUrl("webcal://ical.booking.com/v1/export?t=abc"), { ok: true, url: "https://ical.booking.com/v1/export?t=abc" });
  assert.equal(checkFeedUrl("http://8.8.8.8/cal.ics").ok, true);
  assert.equal(checkFeedUrl("http://[2606:4700::1111]/cal.ics").ok, true);
  // Only tests may read from this machine.
  assert.equal(checkFeedUrl("http://127.0.0.1:4000/cal.ics", true).ok, true);
  assert.equal(checkFeedUrl("file:///etc/passwd", true).ok, false);
  assert.equal(isPrivateAddress("172.32.0.1"), false);
  assert.equal(isPrivateAddress("100.64.0.1"), true);
});
