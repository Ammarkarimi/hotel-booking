import { test } from "node:test";
import assert from "node:assert/strict";
import { hotelMetrics, roomsForSale } from "../reports";

test("per-available-room numbers divide by every room, not only the rooms sold", () => {
  // 25 rooms, 10 sold at ₹5,000 for one night, ₹20,000 of costs that day.
  const m = hotelMetrics({ roomsAvailable: 25, roomsSold: 10, roomRevenue: 50000, extrasRevenue: 0, expenses: 20000 });
  assert.equal(m.occupancy, 40);
  assert.equal(m.adr, 5000); // average price of a room sold
  assert.equal(m.revpar, 2000); // ₹50,000 ÷ 25 rooms
  assert.equal(m.costPerAvailableRoom, 800); // ₹20,000 ÷ 25 rooms
  assert.equal(m.costPerOccupiedRoom, 2000); // ₹20,000 ÷ 10 rooms sold
  assert.equal(m.profit, 30000);
  assert.equal(m.profitPerAvailableRoom, 1200);
  assert.equal(m.margin, 60);
});

test("extras count towards total earnings and profit but not the room price", () => {
  const m = hotelMetrics({ roomsAvailable: 10, roomsSold: 5, roomRevenue: 10000, extrasRevenue: 2000, expenses: 15000 });
  assert.equal(m.adr, 2000);
  assert.equal(m.revpar, 1000);
  assert.equal(m.trevpar, 1200);
  assert.equal(m.revenue, 12000);
  assert.equal(m.profit, -3000); // a loss
  assert.equal(m.margin, -25);
});

test("nothing sold or no rooms gives zeros, not errors", () => {
  const m = hotelMetrics({ roomsAvailable: 0, roomsSold: 0, roomRevenue: 0, extrasRevenue: 0, expenses: 500 });
  assert.equal(m.occupancy, 0);
  assert.equal(m.adr, 0);
  assert.equal(m.revpar, 0);
  assert.equal(m.costPerOccupiedRoom, 0);
  assert.equal(m.profit, -500);
  assert.equal(m.margin, 0);
});

test("a room under repair now is not for sale from today, but counts on earlier nights", () => {
  const rooms = [
    { roomNumber: "101", status: "available" },
    { roomNumber: "102", status: "maintenance" },
    { roomNumber: "103", status: "occupied" },
  ];
  const today = "2026-10-28";
  assert.equal(roomsForSale(rooms, "2026-09-15", today).length, 3); // it may have been sold back then
  assert.equal(roomsForSale(rooms, today, today).length, 2);
  assert.equal(roomsForSale(rooms, "2026-11-02", today).length, 2);
  // If every room is under repair, still count them all rather than divide by zero.
  assert.equal(roomsForSale([{ status: "maintenance" }], today, today).length, 1);
});
