import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, defaultGroupBy, groupKey, periodLabel, periodRange, shiftPeriod, weekStart } from "../periods";

test("weeks run Monday to Sunday", () => {
  assert.equal(weekStart("2026-10-27"), "2026-10-26"); // Tuesday -> Monday
  assert.equal(weekStart("2026-10-26"), "2026-10-26");
  assert.equal(weekStart("2026-11-01"), "2026-10-26"); // Sunday belongs to the week before
  assert.deepEqual(periodRange("week", "2026-10-27"), { from: "2026-10-26", to: "2026-11-01" });
});

test("months and years", () => {
  assert.deepEqual(periodRange("month", "2026-02-14"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(periodRange("month", "2028-02-14"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(periodRange("year", "2026-10-27"), { from: "2026-01-01", to: "2026-12-31" });
  assert.equal(addMonths("2026-12-15", 1), "2027-01-01");
  assert.equal(addMonths("2026-01-31", -1), "2025-12-01");
});

test("previous and next period", () => {
  assert.equal(shiftPeriod("day", "2026-10-31", 1), "2026-11-01");
  assert.equal(shiftPeriod("week", "2026-10-27", -1), "2026-10-20");
  assert.equal(shiftPeriod("month", "2026-03-31", -1), "2026-02-01");
  assert.equal(shiftPeriod("year", "2026-10-27", 1), "2027-01-01");
});

test("grouping days into weeks and months", () => {
  assert.equal(groupKey("2026-10-29", "day"), "2026-10-29");
  assert.equal(groupKey("2026-10-29", "week"), "2026-10-26");
  assert.equal(groupKey("2026-10-29", "month"), "2026-10-01");
  assert.equal(defaultGroupBy("2026-10-01", "2026-10-31"), "day");
  assert.equal(defaultGroupBy("2026-08-01", "2026-10-31"), "week");
  assert.equal(defaultGroupBy("2026-01-01", "2026-12-31"), "month");
});

test("period names", () => {
  assert.equal(periodLabel("month", "2026-10-01", "2026-10-31"), "October 2026");
  assert.equal(periodLabel("year", "2026-01-01", "2026-12-31"), "2026");
  assert.equal(periodLabel("week", "2026-10-26", "2026-11-01"), "26 Oct – 1 Nov 2026");
  assert.equal(periodLabel("custom", "2025-12-29", "2026-01-04"), "29 Dec 2025 – 4 Jan 2026");
  assert.equal(periodLabel("day", "2026-10-27", "2026-10-27"), "Tue, 27 Oct 2026");
});
