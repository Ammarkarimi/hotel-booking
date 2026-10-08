import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeFolio,
  paymentState,
  parseGstSlabs,
  priceNights,
  roomTaxRate,
  DEFAULT_GST_SLABS,
  type TaxRules,
} from "../pricing";

const flat12: TaxRules = { taxMode: "flat", taxRate: 12, gstSlabs: DEFAULT_GST_SLABS, extrasTaxRate: 5 };
const gst: TaxRules = { taxMode: "india_gst", taxRate: 0, gstSlabs: DEFAULT_GST_SLABS, extrasTaxRate: 5 };
const noRules = { weekendSurcharge: 0, seasonalRates: [] };

test("plain stay is base rate times nights", () => {
  const nights = priceNights({ baseRate: 2000, checkIn: "2026-10-05", checkOut: "2026-10-08", roomType: "double", rules: noRules });
  assert.equal(nights.length, 3);
  assert.deepEqual(nights.map((n) => n.rate), [2000, 2000, 2000]);
});

test("weekend surcharge applies only to Friday and Saturday nights", () => {
  const nights = priceNights({
    baseRate: 1000,
    checkIn: "2026-10-08", // Thu
    checkOut: "2026-10-11", // Sun
    roomType: "double",
    rules: { weekendSurcharge: 20, seasonalRates: [] },
  });
  assert.deepEqual(nights.map((n) => n.rate), [1000, 1200, 1200]);
});

test("seasonal rules stack, respect room type, and are skipped for fixed rates", () => {
  const rules = {
    weekendSurcharge: 0,
    seasonalRates: [
      { startDate: "2026-10-20", endDate: "2026-10-21", roomType: null, percent: 50 },
      { startDate: "2026-10-21", endDate: "2026-10-21", roomType: "suite", percent: 10 },
    ],
  };
  const dbl = priceNights({ baseRate: 1000, checkIn: "2026-10-19", checkOut: "2026-10-22", roomType: "double", rules });
  assert.deepEqual(dbl.map((n) => n.rate), [1000, 1500, 1500]);
  const suite = priceNights({ baseRate: 1000, checkIn: "2026-10-21", checkOut: "2026-10-22", roomType: "suite", rules });
  assert.deepEqual(suite.map((n) => n.rate), [1600]);
  const fixed = priceNights({ baseRate: 1000, checkIn: "2026-10-20", checkOut: "2026-10-21", roomType: "suite", fixedRate: true, rules });
  assert.deepEqual(fixed.map((n) => n.rate), [1000]);
});

test("Indian GST slab depends on the nightly tariff", () => {
  assert.equal(roomTaxRate(900, gst), 0);
  assert.equal(roomTaxRate(1000, gst), 0);
  assert.equal(roomTaxRate(1001, gst), 5);
  assert.equal(roomTaxRate(7500, gst), 5);
  assert.equal(roomTaxRate(7501, gst), 18);
  assert.equal(roomTaxRate(7501, flat12), 12);
});

test("parseGstSlabs sorts, handles open-ended slab and falls back to defaults", () => {
  assert.deepEqual(parseGstSlabs('[{"upTo":null,"rate":18},{"upTo":1000,"rate":0}]'), [
    { upTo: 1000, rate: 0 },
    { upTo: null, rate: 18 },
  ]);
  assert.deepEqual(parseGstSlabs("not json"), DEFAULT_GST_SLABS);
  assert.deepEqual(parseGstSlabs("[]"), DEFAULT_GST_SLABS);
});

test("folio adds room, discount, extras, taxes, payments and refunds", () => {
  const nights = priceNights({ baseRate: 4000, checkIn: "2026-10-05", checkOut: "2026-10-08", roomType: "double", rules: noRules });
  const folio = computeFolio({
    nights,
    discount: 2000,
    charges: [{ amount: 500 }, { amount: 300 }],
    payments: [
      { amount: 5000, type: "advance" },
      { amount: 1000, type: "refund" },
      { amount: 999, type: "balance", status: "failed" },
    ],
    tax: flat12,
  });
  assert.equal(folio.roomTotal, 12000);
  assert.equal(folio.roomAfterDiscount, 10000);
  assert.equal(folio.roomTax, 1200);
  assert.equal(folio.extrasTotal, 800);
  assert.equal(folio.extrasTax, 40);
  assert.equal(folio.grandTotal, 12040);
  assert.equal(folio.paid, 5000);
  assert.equal(folio.refunded, 1000);
  assert.equal(folio.balance, 8040);
});

test("discount can never exceed room total; GST slab uses discounted nightly rate", () => {
  const nights = priceNights({ baseRate: 8000, checkIn: "2026-10-05", checkOut: "2026-10-07", roomType: "suite", rules: noRules });
  const big = computeFolio({ nights, discount: 99999, charges: [], payments: [], tax: gst });
  assert.equal(big.discount, 16000);
  assert.equal(big.grandTotal, 0);
  const discounted = computeFolio({ nights, discount: 2000, charges: [], payments: [], tax: gst });
  // 14000 / 2 nights = 7000 per night -> 5% slab
  assert.equal(discounted.roomTaxRate, 5);
  assert.equal(discounted.roomTax, 700);
});

test("payment state", () => {
  assert.equal(paymentState(1000, 0), "unpaid");
  assert.equal(paymentState(1000, 400), "partial");
  assert.equal(paymentState(1000, 1000), "paid");
  assert.equal(paymentState(1000, 1200), "overpaid");
  assert.equal(paymentState(0, 0), "paid");
});
