import { test } from "node:test";
import assert from "node:assert/strict";
import { splitAcross, summarizeGroup } from "../groups";

test("one payment for a group pays off each room's bill in turn; the rest stays on the first room", () => {
  const rooms = [
    { id: "a", balance: 5000 },
    { id: "b", balance: 3000 },
    { id: "c", balance: 2000 },
  ];
  assert.deepEqual(splitAcross(6000, rooms), [
    { id: "a", amount: 5000 },
    { id: "b", amount: 1000 },
  ]);
  assert.deepEqual(splitAcross(12000, rooms), [
    { id: "a", amount: 7000 },
    { id: "b", amount: 3000 },
    { id: "c", amount: 2000 },
  ]);
  // A room already paid is skipped; a cancelled room never gets money.
  assert.deepEqual(splitAcross(4000, [{ id: "a", balance: 0 }, { id: "x", balance: 9000, status: "cancelled" }, { id: "b", balance: 3000 }]), [
    { id: "a", amount: 1000 },
    { id: "b", amount: 3000 },
  ]);
  // Paise add up exactly.
  const shares = splitAcross(1000.05, [{ id: "a", balance: 333.33 }, { id: "b", balance: 333.33 }, { id: "c", balance: 333.34 }]);
  assert.equal(Math.round(shares.reduce((s, x) => s + x.amount, 0) * 100) / 100, 1000.05);
  assert.deepEqual(splitAcross(100, [{ id: "x", balance: 10, status: "no_show" }]), []);
});

test("a group's totals leave out cancelled rooms", () => {
  const room = { roomType: "deluxe", children: 0, invoiceNumber: null };
  const g = summarizeGroup("g", [
    { ...room, id: "b", number: 1002, roomNumber: "102", status: "reserved", adults: 2, total: 3000, paid: 0, balance: 3000 },
    { ...room, id: "a", number: 1001, roomNumber: "101", status: "checked_in", adults: 2, total: 5000, paid: 6000, balance: -1000 },
    { ...room, id: "c", number: 1003, roomNumber: "103", status: "cancelled", adults: 3, total: 4000, paid: 0, balance: 4000 },
  ]);
  assert.deepEqual(g.rooms.map((r) => r.number), [1001, 1002, 1003]);
  assert.equal(g.adults, 4);
  assert.equal(g.total, 8000);
  assert.equal(g.paid, 6000);
  assert.equal(g.balance, 3000); // money paid extra on one room is not taken off another room's bill
});
