import { test } from "node:test";
import assert from "node:assert/strict";
import { currentHotelId, runForHotel, scopeArgs } from "../db";

test("reads, updates and deletes only ever touch the current hotel", () => {
  for (const op of ["findMany", "findUnique", "findFirst", "count", "aggregate", "update", "updateMany", "delete", "deleteMany"]) {
    assert.deepEqual(scopeArgs(op, { where: { id: "b1" } }, "h1").where, { id: "b1", hotelId: "h1" }, op);
  }
  assert.deepEqual(scopeArgs("findMany", undefined, "h1"), { where: { hotelId: "h1" } });
});

test("a different hotel id in a query is overridden, never trusted", () => {
  assert.deepEqual(scopeArgs("findMany", { where: { hotelId: "other" } }, "h1").where, { hotelId: "h1" });
  assert.deepEqual(scopeArgs("create", { data: { name: "x", hotelId: "other" } }, "h1").data, { name: "x", hotelId: "h1" });
});

test("new rows are stamped with the current hotel", () => {
  assert.deepEqual(scopeArgs("createMany", { data: [{ a: 1 }, { a: 2 }] }, "h1").data, [
    { a: 1, hotelId: "h1" },
    { a: 2, hotelId: "h1" },
  ]);
  const upsert = scopeArgs("upsert", { where: { bookingId: "b1" }, create: { bookingId: "b1" }, update: {} }, "h1");
  assert.deepEqual(upsert.where, { bookingId: "b1", hotelId: "h1" });
  assert.deepEqual(upsert.create, { bookingId: "b1", hotelId: "h1" });
});

test("hotel context follows async work and is absent outside it", async () => {
  assert.throws(() => currentHotelId(), /No hotel selected/);
  const seen = await runForHotel("h1", async () => {
    await new Promise((r) => setTimeout(r, 5));
    return currentHotelId();
  });
  assert.equal(seen, "h1");
  // Lazy thenables (like Prisma queries) returned directly still run inside the hotel.
  const lazy = { then: (resolve: (v: string) => void) => resolve(currentHotelId()) };
  assert.equal(await runForHotel("h2", () => lazy), "h2");
});
