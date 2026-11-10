import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TALLY_LEDGERS, moneyLedger, parseTallyLedgers, partyFor, salesEntries, splitGst, tallyMastersXml, tallyVouchersXml } from "../tally";

const L = DEFAULT_TALLY_LEDGERS;
const invoice = {
  id: "bill1",
  invoiceNumber: "INV-1009",
  date: "2026-11-07",
  bookingNumber: 1009,
  guestName: "Priya Sharma",
  room: "301",
  roomTaxable: 9600,
  extrasTaxable: 480,
  tax: 504.01,
};

test("ledger names: the saved ones, with the defaults for empty ones", () => {
  assert.deepEqual(parseTallyLedgers(""), DEFAULT_TALLY_LEDGERS);
  assert.deepEqual(parseTallyLedgers("oops"), DEFAULT_TALLY_LEDGERS);
  const L2 = parseTallyLedgers('{"roomSales":"Room Rent","cash":"  ","x":"y"}');
  assert.equal(L2.roomSales, "Room Rent");
  assert.equal(L2.cash, "Cash");
  assert.equal("x" in L2, false);
});

test("a Sales voucher always balances, with GST split into CGST and SGST", () => {
  assert.deepEqual(splitGst(504.01), { cgst: 252, sgst: 252.01 });
  assert.deepEqual(splitGst(480), { cgst: 240, sgst: 240 });
  const e = salesEntries(invoice, L);
  assert.equal(Math.round(e.reduce((s, x) => s + x.amount, 0) * 100), 0);
  assert.deepEqual(e[0], { ledger: "Room Guests", amount: 10584.01, party: true });
  // A guest with a GSTIN gets their own ledger, named after the company.
  assert.equal(partyFor({ guestName: "Rajesh", company: "Kumar Traders", gstin: "29aaack1234m1z2" }, L).name, "Kumar Traders (29AAACK1234M1Z2)");
  assert.equal(moneyLedger("cash", L), "Cash");
  assert.equal(moneyLedger("upi", L), "Bank Account");
  assert.equal(moneyLedger("ota", L), "Booking Sites");
});

test("the Tally files: ledgers first, then Sales, Receipt and Payment vouchers", () => {
  const data = {
    company: "Sunrise & Co",
    ledgers: L,
    invoices: [invoice, { ...invoice, id: "bill2", invoiceNumber: "INV-1010", company: "Kumar Traders", gstin: "29AAACK1234M1Z2", state: "Karnataka" }],
    payments: [
      { id: "p1", date: "2026-11-05", bookingNumber: 1009, guestName: "Priya Sharma", amount: 4000, method: "upi", type: "advance", reference: "UTR<1>" },
      { id: "p2", date: "2026-11-07", bookingNumber: 1009, invoiceNumber: "INV-1009", guestName: "Priya Sharma", amount: 500, method: "cash", type: "refund" },
    ],
  };
  const masters = tallyMastersXml(data);
  assert.match(masters, /<REPORTNAME>All Masters<\/REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Sunrise &amp; Co<\/SVCURRENTCOMPANY>/);
  assert.match(masters, /<LEDGER NAME="Room Sales" ACTION="Create">.*<PARENT>Sales Accounts<\/PARENT>/);
  assert.match(masters, /<LEDGER NAME="Output CGST" ACTION="Create">.*<PARENT>Duties &amp; Taxes<\/PARENT>/);
  assert.match(masters, /<LEDGER NAME="Kumar Traders \(29AAACK1234M1Z2\)".*<PARTYGSTIN>29AAACK1234M1Z2<\/PARTYGSTIN>.*<LEDSTATENAME>Karnataka<\/LEDSTATENAME>/);
  assert.equal((masters.match(/<LEDGER /g) ?? []).length, 9);

  const vouchers = tallyVouchersXml(data);
  assert.match(vouchers, /<REPORTNAME>Vouchers<\/REPORTNAME>/);
  assert.equal((vouchers.match(/VCHTYPE="Sales"/g) ?? []).length, 2);
  assert.match(vouchers, /<DATE>20261107<\/DATE>/);
  assert.match(vouchers, /<VOUCHERNUMBER>INV-1009<\/VOUCHERNUMBER>/);
  // Debits are "deemed positive" with a minus sign; credits are plain.
  assert.match(vouchers, /<LEDGERNAME>Room Guests<\/LEDGERNAME><ISDEEMEDPOSITIVE>Yes<\/ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes<\/ISPARTYLEDGER><AMOUNT>-10584.01<\/AMOUNT>/);
  assert.match(vouchers, /<LEDGERNAME>Room Sales<\/LEDGERNAME><ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE><AMOUNT>9600.00<\/AMOUNT>/);
  assert.match(vouchers, /VCHTYPE="Receipt".*<LEDGERNAME>Bank Account<\/LEDGERNAME><ISDEEMEDPOSITIVE>Yes<\/ISDEEMEDPOSITIVE><AMOUNT>-4000.00<\/AMOUNT>/);
  assert.match(vouchers, /ref UTR&lt;1&gt;/);
  assert.match(vouchers, /VCHTYPE="Payment".*<LEDGERNAME>Cash<\/LEDGERNAME><ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE><AMOUNT>500.00<\/AMOUNT>/);
  // Every voucher balances.
  for (const v of vouchers.split("</VOUCHER>").slice(0, -1)) {
    const amounts = [...v.matchAll(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map((m) => Math.round(Number(m[1]) * 100));
    assert.equal(amounts.reduce((s, a) => s + a, 0), 0);
  }
});
