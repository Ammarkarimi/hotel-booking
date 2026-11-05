import { test } from "node:test";
import assert from "node:assert/strict";
import { banquetBill, banquetInvoiceNumber, billedPlates, functionsClash } from "../banquet-bill";

const base = {
  expectedPax: 200,
  guaranteedPax: 0,
  actualPax: null as number | null,
  platePrice: 500,
  foodGst: 5,
  hallRent: 20000,
  hallGst: 18,
  discount: 0,
  items: [] as Array<{ amount: number; gstRate: number }>,
  payments: [] as Array<{ amount: number; type: string }>,
};

test("plates billed: served (or expected) but never fewer than guaranteed", () => {
  assert.equal(billedPlates({ expectedPax: 200, guaranteedPax: 0, actualPax: null }), 200);
  assert.equal(billedPlates({ expectedPax: 200, guaranteedPax: 180, actualPax: 150 }), 180);
  assert.equal(billedPlates({ expectedPax: 200, guaranteedPax: 180, actualPax: 230 }), 230);
});

test("food, hall rent and extras each get their own GST", () => {
  const b = banquetBill({ ...base, items: [{ amount: 15000, gstRate: 18 }] });
  assert.equal(b.food, 100000);
  assert.equal(b.taxable, 135000);
  assert.deepEqual(b.taxLines, [
    { rate: 5, taxable: 100000, tax: 5000 },
    { rate: 18, taxable: 35000, tax: 6300 },
  ]);
  assert.equal(b.total, 146300);
  assert.equal(b.balance, 146300);
});

test("a discount is shared across the GST rates", () => {
  // ₹1,20,000 before discount; ₹12,000 off = 10% off every line.
  const b = banquetBill({ ...base, discount: 12000 });
  assert.equal(b.taxable, 108000);
  assert.deepEqual(b.taxLines, [
    { rate: 5, taxable: 90000, tax: 4500 },
    { rate: 18, taxable: 18000, tax: 3240 },
  ]);
  assert.equal(b.total, 115740);
});

test("payments and refunds; a cancelled function owes nothing more", () => {
  const paid = banquetBill({ ...base, payments: [{ amount: 50000, type: "advance" }, { amount: 10000, type: "refund" }] });
  assert.equal(paid.netPaid, 40000);
  assert.equal(paid.balance, paid.total - 40000);
  const cancelled = banquetBill({ ...base, status: "cancelled", payments: [{ amount: 25000, type: "advance" }] });
  assert.equal(cancelled.balance, 0);
  assert.equal(cancelled.netPaid, 25000);
});

test("functions in the same hall clash only when their times overlap", () => {
  const lunch = { date: "2026-12-14", start: "12:00", end: "16:00" };
  assert.equal(functionsClash(lunch, { date: "2026-12-14", start: "16:00", end: "19:00" }), false, "back to back is fine");
  assert.equal(functionsClash(lunch, { date: "2026-12-14", start: "15:00", end: "18:00" }), true);
  assert.equal(functionsClash(lunch, { date: "2026-12-15", start: "12:00", end: "16:00" }), false, "another day");
});

test("a function past midnight blocks the early hours of the next day", () => {
  const late = { date: "2026-12-14", start: "20:00", end: "01:00" };
  assert.equal(functionsClash(late, { date: "2026-12-15", start: "00:30", end: "03:00" }), true);
  assert.equal(functionsClash(late, { date: "2026-12-15", start: "08:00", end: "11:00" }), false);
  assert.equal(functionsClash({ date: "2026-12-15", start: "00:00", end: "02:00" }, late), true);
});

test("banquet invoice numbers", () => {
  assert.equal(banquetInvoiceNumber("BQ", 7), "BQ-7");
  assert.equal(banquetInvoiceNumber("", 7), "BQ-7");
});
