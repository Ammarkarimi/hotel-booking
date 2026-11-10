// Online payments from guests: a UPI QR code / link straight to the hotel's own UPI ID, and
// Razorpay payment links (UPI, cards, net banking) that are written down on the booking by
// themselves once paid. Pure: no database or network code, so screens and tests can use it.
import { round2 } from "./pricing";

/** A UPI ID such as sunrise@okaxis or 9876543210@ybl. */
export const UPI_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function isUpiId(value: string | null | undefined): boolean {
  return !!value && UPI_ID_PATTERN.test(value.trim());
}

export interface OnlinePaymentSettings {
  upiId?: string | null;
  upiName?: string | null;
  hotelName: string;
  razorpayKeyId?: string | null;
  /** The sealed secret, or just whether one is saved. */
  razorpayKeySecret?: string | null | boolean;
}

/** Which ways of paying online the hotel has set up. */
export function onlinePaymentWays(s: OnlinePaymentSettings) {
  const upi = isUpiId(s.upiId);
  const razorpay = !!s.razorpayKeyId && !!s.razorpayKeySecret;
  return { upi, razorpay, any: upi || razorpay };
}

/**
 * The amount a payment page asks for: the amount in the link when it is between ₹1 and the
 * balance (an advance), otherwise the whole balance. 0 when nothing is left to pay.
 */
export function amountToPay(balance: number, asked?: string | number | null): number {
  const due = round2(Math.max(0, balance));
  if (due < 1) return 0;
  const n = typeof asked === "string" ? Number(asked) : asked;
  if (typeof n === "number" && Number.isFinite(n) && n >= 1 && n < due) return round2(n);
  return due;
}

/**
 * A UPI payment link (upi://pay…) for the hotel's UPI ID with the amount filled in. Opening it
 * on a phone, or scanning it as a QR code, opens the guest's UPI app ready to pay.
 */
export function upiPayLink(opts: { upiId: string; name: string; amount: number; note: string }): string {
  const params = [
    ["pa", opts.upiId.trim()],
    ["pn", opts.name.trim().slice(0, 50)],
    ["am", opts.amount.toFixed(2)],
    ["cu", "INR"],
    ["tn", opts.note.trim().slice(0, 50)],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/** The note a guest sees in their UPI app, e.g. "Booking 1011, Sunrise Residency". */
export function upiNote(bookingNumber: number, hotelName: string) {
  return `Booking ${bookingNumber}, ${hotelName}`;
}

/** The address of a booking's payment page; with an amount for an advance smaller than the balance. */
export function payPagePath(publicToken: string, amount?: number | null) {
  return `/pay/${publicToken}${amount ? `?a=${round2(amount)}` : ""}`;
}

/** How Razorpay's payment methods are written down in the software. */
export function methodFromRazorpay(method: string | null | undefined): "upi" | "card" | "bank_transfer" | "other" {
  if (method === "upi") return "upi";
  if (method === "card" || method === "emi") return "card";
  if (method === "netbanking") return "bank_transfer";
  return "other";
}

/** Razorpay counts in paise. */
export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const fromPaise = (paise: number) => round2(paise / 100);

export interface LinkPayment {
  payment_id: string;
  amount: number; // paise
  method?: string | null;
  status: string; // captured, authorized, failed, refunded…
  created_at: number; // seconds
}

/** The captured payments of a link that are not written down on the booking yet. */
export function paymentsToRecord(payments: LinkPayment[] | null | undefined, recordedRefs: Iterable<string | null>): LinkPayment[] {
  const seen = new Set(recordedRefs);
  return (payments ?? []).filter((p) => p.status === "captured" && p.amount > 0 && !seen.has(p.payment_id));
}

/** A reference unique to each link (Razorpay refuses a reference it has seen before). At most 40 characters. */
export function linkReference(bookingNumber: number, random: string) {
  return `B${bookingNumber}-${random}`.slice(0, 40);
}
