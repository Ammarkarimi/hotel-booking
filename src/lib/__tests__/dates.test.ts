import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  diffDays,
  eachNight,
  isDateKey,
  isWeekendNight,
  nightsBetween,
  rangesOverlap,
  toDateKey,
  todayKey,
} from "../dates";

test("date keys round-trip and move across month and year ends", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(toDateKey(new Date("2026-05-04T00:00:00Z")), "2026-05-04");
  assert.equal(toDateKey("2026-05-04"), "2026-05-04");
});

test("isDateKey validates format", () => {
  assert.equal(isDateKey("2026-10-08"), true);
  assert.equal(isDateKey("08-10-2026"), false);
  assert.equal(isDateKey(""), false);
  assert.equal(isDateKey(undefined), false);
});

test("nights are counted per calendar day with a minimum of one", () => {
  assert.equal(diffDays("2026-10-08", "2026-10-11"), 3);
  assert.equal(nightsBetween("2026-10-08", "2026-10-11"), 3);
  assert.equal(nightsBetween("2026-10-08", "2026-10-08"), 1);
  assert.deepEqual(eachNight("2026-10-08", "2026-10-10"), ["2026-10-08", "2026-10-09"]);
});

test("checkout day is free for the next guest", () => {
  // Guest A leaves on the 10th; guest B arrives on the 10th: no clash.
  assert.equal(rangesOverlap("2026-10-08", "2026-10-10", "2026-10-10", "2026-10-12"), false);
  assert.equal(rangesOverlap("2026-10-08", "2026-10-11", "2026-10-10", "2026-10-12"), true);
  assert.equal(rangesOverlap("2026-10-09", "2026-10-10", "2026-10-08", "2026-10-12"), true);
});

test("Friday and Saturday nights are weekend nights", () => {
  assert.equal(isWeekendNight("2026-10-09"), true); // Friday
  assert.equal(isWeekendNight("2026-10-10"), true); // Saturday
  assert.equal(isWeekendNight("2026-10-11"), false); // Sunday
});

test("todayKey uses the hotel timezone", () => {
  // 20:00 UTC on 8 Oct is already 9 Oct in India (UTC+5:30).
  const now = new Date("2026-10-08T20:00:00Z");
  assert.equal(todayKey("Asia/Kolkata", now), "2026-10-09");
  assert.equal(todayKey("UTC", now), "2026-10-08");
  assert.equal(todayKey("Not/AZone", now), "2026-10-08");
});
