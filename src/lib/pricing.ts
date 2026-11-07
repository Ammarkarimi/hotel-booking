// Pure pricing and billing maths shared by the API, the screens and the tests.
import { eachNight, isWeekendNight, toDateKey } from "./dates";

export type TaxMode = "flat" | "india_gst";

export interface GstSlab {
  upTo: number | null; // nightly tariff limit (inclusive); null = no limit
  rate: number;
}

export interface PricingRules {
  weekendSurcharge: number;
  seasonalRates: Array<{ startDate: Date | string; endDate: Date | string; roomType: string | null; percent: number }>;
}

export interface TaxRules {
  taxMode: TaxMode | string;
  taxRate: number;
  gstSlabs: GstSlab[];
  extrasTaxRate: number;
}

export const DEFAULT_GST_SLABS: GstSlab[] = [
  { upTo: 1000, rate: 0 },
  { upTo: 7500, rate: 5 },
  { upTo: null, rate: 18 },
];

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseGstSlabs(raw: string | null | undefined): GstSlab[] {
  try {
    const parsed = JSON.parse(raw || "");
    if (Array.isArray(parsed) && parsed.length > 0) {
      const slabs: GstSlab[] = parsed.map((s) => ({ upTo: s.upTo === null || s.upTo === "" ? null : Number(s.upTo), rate: Number(s.rate) || 0 }));
      // Saving settings used to store the "Above that" slab as "up to ₹0". Read it as no limit again.
      if (slabs.length > 1 && !slabs.some((s) => s.upTo === null)) {
        const zero = slabs.findIndex((s) => s.upTo === 0);
        if (zero >= 0) slabs[zero] = { ...slabs[zero], upTo: null };
      }
      return slabs.sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_GST_SLABS;
}

/** Total % change that applies to one night (weekend + any seasonal rules). */
export function nightAdjustment(night: string, roomType: string, rules: PricingRules): number {
  let percent = isWeekendNight(night) ? rules.weekendSurcharge || 0 : 0;
  for (const s of rules.seasonalRates) {
    if (s.roomType && s.roomType !== roomType) continue;
    if (night >= toDateKey(s.startDate) && night <= toDateKey(s.endDate)) percent += s.percent;
  }
  return percent;
}

export interface NightPrice {
  date: string;
  rate: number;
  adjustment: number;
}

export function priceNights(opts: {
  baseRate: number;
  checkIn: Date | string;
  checkOut: Date | string;
  roomType: string;
  fixedRate?: boolean;
  rules: PricingRules;
}): NightPrice[] {
  return eachNight(opts.checkIn, opts.checkOut).map((date) => {
    const adjustment = opts.fixedRate ? 0 : nightAdjustment(date, opts.roomType, opts.rules);
    return { date, adjustment, rate: round2(Math.max(0, opts.baseRate * (1 + adjustment / 100))) };
  });
}

/** Room tax rate. In Indian GST mode the slab depends on the nightly tariff. */
export function roomTaxRate(averageNightly: number, tax: TaxRules): number {
  if (tax.taxMode !== "india_gst") return tax.taxRate;
  const slabs = tax.gstSlabs.length ? tax.gstSlabs : DEFAULT_GST_SLABS;
  for (const slab of slabs) {
    if (slab.upTo === null || averageNightly <= slab.upTo) return slab.rate;
  }
  return slabs[slabs.length - 1].rate;
}

/**
 * The GST slab for a room price that already includes GST: the first slab whose rate,
 * taken out of the price, leaves a tariff inside that slab. For example ₹1,800 with GST
 * is ₹1,714.29 + 5%.
 */
export function roomTaxRateIncluded(inclusiveNightly: number, tax: TaxRules): number {
  if (tax.taxMode !== "india_gst") return tax.taxRate;
  const slabs = tax.gstSlabs.length ? tax.gstSlabs : DEFAULT_GST_SLABS;
  for (const slab of slabs) {
    if (slab.upTo === null || inclusiveNightly / (1 + slab.rate / 100) <= slab.upTo) return slab.rate;
  }
  return slabs[slabs.length - 1].rate;
}

export interface FolioInput {
  nights: NightPrice[];
  discount: number;
  charges: Array<{ amount: number }>;
  payments: Array<{ amount: number; type: string; status?: string }>;
  tax: TaxRules;
  gstRate?: number | null; // GST % on the room chosen for this booking, instead of the default
  /** The room prices and discount already include the room GST (the hotel's setting when the booking was made). */
  pricesIncludeTax?: boolean;
}

export interface Folio {
  /** Room prices were entered with GST included. The room lines below are then before GST, as a bill shows them. */
  pricesIncludeTax: boolean;
  /** The room price and discount as they were entered (with GST when pricesIncludeTax). */
  enteredRoomTotal: number;
  enteredDiscount: number;
  nightCount: number;
  nights: NightPrice[];
  roomTotal: number;
  discount: number;
  roomAfterDiscount: number;
  roomTaxRate: number;
  defaultRoomTaxRate: number; // what Settings would charge, shown when choosing another rate
  roomTax: number;
  extrasTotal: number;
  extrasTaxRate: number;
  extrasTax: number;
  taxTotal: number;
  grandTotal: number;
  paid: number;
  refunded: number;
  netPaid: number;
  balance: number;
}

export function sumPayments(payments: FolioInput["payments"]) {
  let paid = 0;
  let refunded = 0;
  for (const p of payments) {
    if (p.status && p.status !== "completed") continue;
    if (p.type === "refund") refunded += p.amount;
    else paid += p.amount;
  }
  return { paid: round2(paid), refunded: round2(refunded), netPaid: round2(paid - refunded) };
}

export function computeFolio(input: FolioInput): Folio {
  const enteredRoomTotal = round2(input.nights.reduce((s, n) => s + n.rate, 0));
  const enteredDiscount = round2(Math.min(Math.max(0, input.discount || 0), enteredRoomTotal));
  const entered = round2(enteredRoomTotal - enteredDiscount);
  const nightCount = input.nights.length;
  const included = !!input.pricesIncludeTax;
  const perNight = nightCount ? entered / nightCount : 0;
  const defaultRate = included ? roomTaxRateIncluded(perNight, input.tax) : roomTaxRate(perNight, input.tax);
  const rRate = input.gstRate ?? defaultRate;

  let nights = input.nights;
  let roomTotal = enteredRoomTotal;
  let discount = enteredDiscount;
  let roomAfterDiscount = entered;
  let roomTax: number;
  if (included) {
    // The GST is inside the price: take it out, so the room plus GST is exactly what was entered.
    const factor = 1 + rRate / 100;
    roomTax = round2(entered - entered / factor);
    roomAfterDiscount = round2(entered - roomTax);
    roomTotal = round2(enteredRoomTotal / factor);
    discount = round2(roomTotal - roomAfterDiscount);
    nights = input.nights.map((n) => ({ ...n, rate: round2(n.rate / factor), adjustment: round2(n.adjustment / factor) }));
  } else {
    roomTax = round2((roomAfterDiscount * rRate) / 100);
  }
  const extrasTotal = round2(input.charges.reduce((s, c) => s + c.amount, 0));
  const extrasTaxRate = input.tax.extrasTaxRate || 0;
  const extrasTax = round2((extrasTotal * extrasTaxRate) / 100);
  const taxTotal = round2(roomTax + extrasTax);
  const grandTotal = round2(roomAfterDiscount + extrasTotal + taxTotal);
  const { paid, refunded, netPaid } = sumPayments(input.payments);

  return {
    pricesIncludeTax: included,
    enteredRoomTotal,
    enteredDiscount,
    nightCount,
    nights,
    roomTotal,
    discount,
    roomAfterDiscount,
    roomTaxRate: rRate,
    defaultRoomTaxRate: defaultRate,
    roomTax,
    extrasTotal,
    extrasTaxRate,
    extrasTax,
    taxTotal,
    grandTotal,
    paid,
    refunded,
    netPaid,
    balance: round2(grandTotal - netPaid),
  };
}

export type PaymentState = "unpaid" | "partial" | "paid" | "overpaid";

export function paymentState(total: number, netPaid: number): PaymentState {
  if (netPaid <= 0 && total > 0) return "unpaid";
  if (netPaid > total + 0.5) return "overpaid";
  if (netPaid >= total - 0.5) return "paid";
  return "partial";
}
