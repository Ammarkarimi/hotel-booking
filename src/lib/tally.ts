// Files for the accountant's Tally (TallyPrime / Tally.ERP 9) in Tally's XML import format: first
// the ledgers (Import → Masters), then the period's GST invoices as Sales vouchers, money received
// as Receipt vouchers and money given back as Payment vouchers (Import → Transactions). The owner
// can include expenses too: each one becomes a Payment voucher from Cash or Bank to its expense
// ledger. Pure: no database code, so tests can use it.
//
// Accounting: a Sales voucher debits the guest (or their company) with the invoice total and
// credits room sales, other sales and CGST/SGST. A receipt debits Cash or Bank and credits the
// guest. Hotel stays are taxed where the hotel is, so there is never IGST.
import { round2 } from "./pricing";
import { EXPENSE_CATEGORIES, label } from "./utils";

export const TALLY_LEDGER_KEYS = ["roomSales", "extrasSales", "cgst", "sgst", "guests", "cash", "bank", "bookingSites"] as const;
export type TallyLedgerKey = (typeof TALLY_LEDGER_KEYS)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
/** The ledger names: the main ones, and one expense ledger per kind of expense. */
export type TallyLedgers = Record<TallyLedgerKey, string> & { expenses: Record<ExpenseCategory, string> };

/** Expense ledgers as accountants usually name them. All go under Indirect Expenses. */
export const DEFAULT_EXPENSE_LEDGERS: Record<ExpenseCategory, string> = {
  salaries: "Salary",
  utilities: "Electricity and Water",
  supplies: "Housekeeping Supplies",
  kitchen: "Kitchen Expenses",
  laundry: "Laundry Expenses",
  repairs: "Repairs and Maintenance",
  rent: "Rent",
  internet_phone: "Telephone and Internet",
  commission: "Commission Paid",
  marketing: "Advertisement",
  taxes_fees: "Rates and Taxes",
  other: "Miscellaneous Expenses",
};
export const EXPENSE_LEDGER_GROUP = "Indirect Expenses";

export const DEFAULT_TALLY_LEDGERS: TallyLedgers = {
  expenses: DEFAULT_EXPENSE_LEDGERS,
  roomSales: "Room Sales",
  extrasSales: "Food and Other Sales",
  cgst: "Output CGST",
  sgst: "Output SGST",
  guests: "Room Guests",
  cash: "Cash",
  bank: "Bank Account",
  bookingSites: "Booking Sites",
};

/** What each ledger is for, and the Tally group it is made under. */
export const TALLY_LEDGER_INFO: Record<TallyLedgerKey, { label: string; hint: string; group: string }> = {
  roomSales: { label: "Room sales", hint: "Room charges after discount, before GST", group: "Sales Accounts" },
  extrasSales: { label: "Food and other sales", hint: "Food, laundry, minibar and other extras", group: "Sales Accounts" },
  cgst: { label: "CGST", hint: "Half of the GST", group: "Duties & Taxes" },
  sgst: { label: "SGST", hint: "The other half of the GST", group: "Duties & Taxes" },
  guests: { label: "Guests without a GSTIN", hint: "One ledger for all walk-in and personal guests", group: "Sundry Debtors" },
  cash: { label: "Cash", hint: "Cash payments", group: "Cash-in-Hand" },
  bank: { label: "Bank", hint: "UPI, card and bank transfer payments", group: "Bank Accounts" },
  bookingSites: { label: "Booking sites", hint: "Prepaid on a booking site, paid to you later", group: "Sundry Debtors" },
};

/** The hotel's ledger names: the saved ones, with the defaults for any left empty. */
export function parseTallyLedgers(raw: string | null | undefined): TallyLedgers {
  let saved: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed;
  } catch {
    // the defaults
  }
  const out: TallyLedgers = { ...DEFAULT_TALLY_LEDGERS, expenses: { ...DEFAULT_EXPENSE_LEDGERS } };
  for (const k of TALLY_LEDGER_KEYS) {
    const v = saved[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 100);
  }
  const exp = saved.expenses;
  if (exp && typeof exp === "object" && !Array.isArray(exp)) {
    for (const c of EXPENSE_CATEGORIES) {
      const v = (exp as Record<string, unknown>)[c];
      if (typeof v === "string" && v.trim()) out.expenses[c] = v.trim().slice(0, 100);
    }
  }
  return out;
}

/** The ledger an expense goes to; an unknown kind goes to "other". */
export function expenseLedger(category: string, ledgers: TallyLedgers) {
  return ledgers.expenses[category as ExpenseCategory] ?? ledgers.expenses.other;
}

export interface TallyInvoice {
  id: string;
  invoiceNumber: string;
  date: string; // YYYY-MM-DD, the hotel's own day
  bookingNumber: number;
  guestName: string;
  company?: string | null;
  gstin?: string | null;
  state?: string | null;
  room: string;
  roomTaxable: number; // room after discount, before GST
  extrasTaxable: number;
  tax: number; // all GST on the invoice
}

export interface TallyPayment {
  id: string;
  date: string;
  bookingNumber: number;
  invoiceNumber?: string | null;
  guestName: string;
  company?: string | null;
  gstin?: string | null;
  amount: number;
  method: string; // cash, upi, card, bank_transfer, ota, other
  type: string; // advance, balance, full, refund
  reference?: string | null;
}

export interface TallyExpense {
  id: string;
  date: string;
  category: string;
  title: string;
  description?: string | null;
  amount: number;
  method: string; // cash, upi, card, bank_transfer, other
  addedBy?: string | null;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const day = (d: string) => d.replace(/-/g, "");
const amt = (n: number) => round2(n).toFixed(2);

/** A guest with a GSTIN gets their own ledger (for GSTR-1 B2B); everyone else shares one. */
export function partyFor(x: { company?: string | null; gstin?: string | null; guestName: string }, ledgers: TallyLedgers) {
  const gstin = x.gstin?.trim().toUpperCase();
  if (!gstin) return { name: ledgers.guests, gstin: null as string | null };
  const name = (x.company?.trim() || x.guestName).slice(0, 80);
  return { name: `${name} (${gstin})`, gstin };
}

/** Which ledger money came into (or went out of). */
export function moneyLedger(method: string, ledgers: TallyLedgers) {
  if (method === "cash") return ledgers.cash;
  if (method === "ota") return ledgers.bookingSites;
  return ledgers.bank;
}

/** CGST and SGST: half each, the odd paisa on SGST so they always add up to the GST. */
export function splitGst(tax: number) {
  const cgst = round2(Math.floor(round2(tax) * 50) / 100);
  return { cgst, sgst: round2(tax - cgst) };
}

interface Entry {
  ledger: string;
  amount: number; // positive = debit, negative = credit
  party?: boolean;
}

function voucher(opts: { type: "Sales" | "Receipt" | "Payment"; id: string; date: string; number: string; party: string; narration: string; entries: Entry[] }) {
  const lines = opts.entries
    .filter((e) => Math.abs(e.amount) >= 0.005)
    .map((e) => {
      // Tally: debits are "deemed positive" and written as negative amounts.
      const debit = e.amount > 0;
      return [
        "<ALLLEDGERENTRIES.LIST>",
        `<LEDGERNAME>${xml(e.ledger)}</LEDGERNAME>`,
        `<ISDEEMEDPOSITIVE>${debit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>`,
        e.party ? "<ISPARTYLEDGER>Yes</ISPARTYLEDGER>" : "",
        `<AMOUNT>${debit ? "-" : ""}${amt(Math.abs(e.amount))}</AMOUNT>`,
        "</ALLLEDGERENTRIES.LIST>",
      ].join("");
    });
  return [
    `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER REMOTEID="innvela-${xml(opts.id)}" VCHTYPE="${opts.type}" ACTION="Create" OBJVIEW="Accounting Voucher View">`,
    `<DATE>${day(opts.date)}</DATE>`,
    `<EFFECTIVEDATE>${day(opts.date)}</EFFECTIVEDATE>`,
    `<VOUCHERTYPENAME>${opts.type}</VOUCHERTYPENAME>`,
    `<VOUCHERNUMBER>${xml(opts.number)}</VOUCHERNUMBER>`,
    `<PARTYLEDGERNAME>${xml(opts.party)}</PARTYLEDGERNAME>`,
    "<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>",
    `<NARRATION>${xml(opts.narration)}</NARRATION>`,
    ...lines,
    "</VOUCHER></TALLYMESSAGE>",
  ].join("");
}

function ledgerMaster(name: string, group: string, gstin?: string | null, state?: string | null) {
  return [
    `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${xml(name)}" ACTION="Create">`,
    `<NAME.LIST><NAME>${xml(name)}</NAME></NAME.LIST>`,
    `<PARENT>${xml(group)}</PARENT>`,
    group === "Sundry Debtors" ? "<ISBILLWISEON>No</ISBILLWISEON>" : "",
    gstin ? `<PARTYGSTIN>${xml(gstin)}</PARTYGSTIN><GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>` : "",
    gstin && state ? `<LEDSTATENAME>${xml(state)}</LEDSTATENAME>` : "",
    "</LEDGER></TALLYMESSAGE>",
  ].join("");
}

/** The Sales voucher entries for one invoice. They always balance: the guest owes exactly what is credited. */
export function salesEntries(inv: TallyInvoice, ledgers: TallyLedgers): Entry[] {
  const { cgst, sgst } = splitGst(inv.tax);
  const credits = [
    { ledger: ledgers.roomSales, amount: -round2(inv.roomTaxable) },
    { ledger: ledgers.extrasSales, amount: -round2(inv.extrasTaxable) },
    { ledger: ledgers.cgst, amount: -cgst },
    { ledger: ledgers.sgst, amount: -sgst },
  ];
  const total = round2(-credits.reduce((s, c) => s + c.amount, 0));
  return [{ ledger: partyFor(inv, ledgers).name, amount: total, party: true }, ...credits];
}

export interface TallyExport {
  company?: string | null;
  invoices: TallyInvoice[];
  payments: TallyPayment[];
  /** Left out (or empty) for the files without expenses. */
  expenses?: TallyExpense[];
  ledgers: TallyLedgers;
}

function envelope(report: "All Masters" | "Vouchers", company: string | null | undefined, messages: string[]) {
  const target = company?.trim() ? `<STATICVARIABLES><SVCURRENTCOMPANY>${xml(company.trim())}</SVCURRENTCOMPANY></STATICVARIABLES>` : "";
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<ENVELOPE>",
    "<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>",
    "<BODY><IMPORTDATA>",
    `<REQUESTDESC><REPORTNAME>${report}</REPORTNAME>${target}</REQUESTDESC>`,
    "<REQUESTDATA>",
    ...messages,
    "</REQUESTDATA>",
    "</IMPORTDATA></BODY>",
    "</ENVELOPE>",
    "",
  ].join("\n");
}

/** File 1 (import first, Import → Masters): the ledgers the vouchers use, including one per guest with a GSTIN. */
export function tallyMastersXml(opts: TallyExport): string {
  const L = opts.ledgers;
  const masters = new Map<string, string>();
  for (const k of TALLY_LEDGER_KEYS) masters.set(L[k], ledgerMaster(L[k], TALLY_LEDGER_INFO[k].group));
  // Only the expense ledgers this period uses.
  for (const e of opts.expenses ?? []) {
    const name = expenseLedger(e.category, L);
    if (!masters.has(name)) masters.set(name, ledgerMaster(name, EXPENSE_LEDGER_GROUP));
  }
  for (const x of [...opts.invoices, ...opts.payments]) {
    const p = partyFor(x, L);
    if (p.gstin && !masters.has(p.name)) masters.set(p.name, ledgerMaster(p.name, "Sundry Debtors", p.gstin, "state" in x ? x.state : null));
  }
  return envelope("All Masters", opts.company, [...masters.values()]);
}

/** File 2 (Import → Transactions / Vouchers): Sales for each invoice, Receipt for money in, Payment for refunds. */
export function tallyVouchersXml(opts: TallyExport): string {
  const L = opts.ledgers;
  const vouchers: string[] = [];
  for (const inv of opts.invoices) {
    vouchers.push(
      voucher({
        type: "Sales",
        id: `invoice-${inv.id}`,
        date: inv.date,
        number: inv.invoiceNumber,
        party: partyFor(inv, L).name,
        narration: `Booking #${inv.bookingNumber}, Room ${inv.room}, ${inv.guestName}`,
        entries: salesEntries(inv, L),
      })
    );
  }
  for (const p of opts.payments) {
    const party = partyFor(p, L).name;
    const money = moneyLedger(p.method, L);
    const refund = p.type === "refund";
    const narration = [
      `${refund ? "Refund" : "Received"} for booking #${p.bookingNumber}${p.invoiceNumber ? ` (invoice ${p.invoiceNumber})` : ""}, ${p.guestName}`,
      `by ${p.method.replace(/_/g, " ")}`,
      p.reference ? `ref ${p.reference}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    vouchers.push(
      voucher({
        type: refund ? "Payment" : "Receipt",
        id: `payment-${p.id}`,
        date: p.date,
        number: `${refund ? "R" : "P"}-${p.bookingNumber}`,
        party,
        narration,
        // Receipt: money in (debit), the guest pays off what they owe (credit). A refund is the other way round.
        entries: refund
          ? [
              { ledger: party, amount: p.amount, party: true },
              { ledger: money, amount: -p.amount },
            ]
          : [
              { ledger: money, amount: p.amount },
              { ledger: party, amount: -p.amount, party: true },
            ],
      })
    );
  }
  // Expenses: money out of Cash or Bank (credit) to the expense ledger (debit).
  const perDay = new Map<string, number>();
  for (const e of opts.expenses ?? []) {
    if (!(e.amount > 0)) continue;
    const money = moneyLedger(e.method, L);
    const n = (perDay.get(e.date) ?? 0) + 1;
    perDay.set(e.date, n);
    vouchers.push(
      voucher({
        type: "Payment",
        id: `expense-${e.id}`,
        date: e.date,
        number: `E-${day(e.date)}-${n}`,
        party: money,
        narration: [e.title, e.description, label(e.category), `paid by ${e.method.replace(/_/g, " ")}`, e.addedBy ? `entered by ${e.addedBy}` : ""].filter(Boolean).join(", "),
        entries: [
          { ledger: expenseLedger(e.category, L), amount: e.amount },
          { ledger: money, amount: -e.amount, party: true },
        ],
      })
    );
  }
  return envelope("Vouchers", opts.company, vouchers);
}
