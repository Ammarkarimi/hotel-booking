import { test } from "node:test";
import assert from "node:assert/strict";
import { netAfterDeductions, payoutSummary } from "../payouts";

const none = { payoutCommission: 0, payoutCommissionGst: 0, payoutTcs: 0, payoutTds: 0, payoutReceivedOn: null };

test("a booking site pays the gross minus commission, GST on it, TCS and TDS", () => {
  // ₹2,500 booking: 15% commission, 18% GST on it, 0.5% TCS and 0.1% TDS.
  const d = { commission: 375, commissionGst: 67.5, tcs: 12.5, tds: 2.5 };
  assert.equal(netAfterDeductions(2500, d), 2042.5);
  const p = payoutSummary(2500, { ...none, payoutAmount: 2042.5, payoutCommission: 375, payoutCommissionGst: 67.5, payoutTcs: 12.5, payoutTds: 2.5 })!;
  assert.equal(p.deductions, 457.5);
  assert.equal(p.other, 0);
  assert.equal(p.fees, 442.5); // a cost to the hotel
  assert.equal(p.taxHeld, 15); // can be claimed back
  assert.equal(p.received, false);
});

test("only the amount received entered: the whole gap is other deductions", () => {
  const p = payoutSummary(2500, { ...none, payoutAmount: 2100, payoutReceivedOn: "2026-10-28" })!;
  assert.equal(p.deductions, 400);
  assert.equal(p.other, 400);
  assert.equal(p.fees, 400);
  assert.equal(p.received, true);
});

test("no payout entered yet", () => {
  assert.equal(payoutSummary(2500, { ...none, payoutAmount: null }), null);
});
