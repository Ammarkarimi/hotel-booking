// The few Razorpay API calls the software makes: create a payment link, read it back, and check
// that the keys work. https://razorpay.com/docs/api/payments/payment-links/
import { createHmac, timingSafeEqual } from "node:crypto";
import { fail } from "./api";
import type { LinkPayment } from "./online-payments";

const API = "https://api.razorpay.com/v1";

export interface RazorpayKeys {
  keyId: string;
  keySecret: string;
}

export interface RazorpayLink {
  id: string;
  short_url: string;
  status: string; // created, partially_paid, paid, cancelled, expired
  amount: number; // paise
  amount_paid?: number;
  reference_id?: string;
  payments?: LinkPayment[] | null;
}

async function call<T>(keys: RazorpayKeys, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64")}`,
        ...(init?.body !== undefined && { "Content-Type": "application/json" }),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    fail("Cannot reach Razorpay right now. Please try again in a minute.", 502);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) fail("Razorpay did not accept the key ID and secret. Please check them in Settings → Online payments.", 400);
  if (!res.ok) fail(`Razorpay: ${data?.error?.description || `error ${res.status}`}`, 502);
  return data as T;
}

export function createLink(
  keys: RazorpayKeys,
  link: { amountPaise: number; description: string; reference: string; customer: { name: string; contact?: string }; callbackUrl: string; expireBy: number; bookingId: string }
) {
  return call<RazorpayLink>(keys, "/payment_links", {
    method: "POST",
    body: {
      amount: link.amountPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: link.reference,
      description: link.description.slice(0, 2000),
      customer: { name: link.customer.name.slice(0, 100), ...(link.customer.contact && { contact: link.customer.contact }) },
      // The hotel sends the link itself on WhatsApp.
      notify: { sms: false, email: false },
      reminder_enable: false,
      expire_by: link.expireBy,
      callback_url: link.callbackUrl,
      callback_method: "get",
      notes: { booking_id: link.bookingId },
    },
  });
}

export function fetchLink(keys: RazorpayKeys, linkId: string) {
  return call<RazorpayLink>(keys, `/payment_links/${encodeURIComponent(linkId)}`);
}

/** Fails with a clear message when the keys are wrong. */
export async function checkKeys(keys: RazorpayKeys) {
  await call(keys, "/payment_links?count=1");
}

/**
 * Razorpay sends the guest back to the payment page with these, signed with the key secret:
 * HMAC-SHA256 of "link_id|reference_id|status|payment_id".
 */
export function verifyCallback(
  keySecret: string,
  q: { linkId: string; reference: string; status: string; paymentId: string; signature: string }
): boolean {
  const expected = createHmac("sha256", keySecret).update(`${q.linkId}|${q.reference}|${q.status}|${q.paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(q.signature || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
