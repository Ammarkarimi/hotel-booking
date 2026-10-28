// Booking-site payouts. A site like MakeMyTrip collects the full price from the guest;
// the hotel's bill and GST invoice stay on that gross amount, while the site pays the
// hotel less: minus its commission (with GST on it), TCS and TDS.
import { round2 } from "./pricing";
import { OTA_SOURCES } from "./utils";

export interface PayoutFields {
  payoutAmount: number | null;
  payoutCommission: number;
  payoutCommissionGst: number;
  payoutTcs: number;
  payoutTds: number;
  payoutReceivedOn: Date | string | null;
}

export function isOtaSource(source: string) {
  return (OTA_SOURCES as readonly string[]).includes(source);
}

/** What the site pays if only the listed deductions are taken off the gross bill. */
export function netAfterDeductions(gross: number, d: { commission?: number; commissionGst?: number; tcs?: number; tds?: number }) {
  return round2(gross - (d.commission || 0) - (d.commissionGst || 0) - (d.tcs || 0) - (d.tds || 0));
}

/**
 * The payout of one booking, or null when it has not been entered.
 * Any gap between the gross and the net that the listed deductions don't explain is
 * "other". Fees (commission, its GST and other) are a cost to the hotel; TCS and TDS
 * are tax the site paid on the hotel's behalf, which it can claim back.
 */
export function payoutSummary(gross: number, p: PayoutFields) {
  if (p.payoutAmount === null || p.payoutAmount === undefined) return null;
  const net = round2(p.payoutAmount);
  const deductions = round2(gross - net);
  const listed = p.payoutCommission + p.payoutCommissionGst + p.payoutTcs + p.payoutTds;
  const other = round2(deductions - listed);
  return {
    gross: round2(gross),
    net,
    commission: round2(p.payoutCommission),
    commissionGst: round2(p.payoutCommissionGst),
    tcs: round2(p.payoutTcs),
    tds: round2(p.payoutTds),
    other,
    deductions,
    fees: round2(p.payoutCommission + p.payoutCommissionGst + Math.max(0, other)),
    taxHeld: round2(p.payoutTcs + p.payoutTds),
    received: !!p.payoutReceivedOn,
  };
}

export type PayoutSummary = NonNullable<ReturnType<typeof payoutSummary>>;
