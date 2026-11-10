// Razorpay payment links on bookings: making one, and writing down what the guest paid through it.
// For rooms booked together the link is for the whole group, and each payment is shared out over
// the rooms' bills (src/lib/groups.ts).
import { randomBytes } from "node:crypto";
import { currentHotelId, prisma } from "./db";
import { fail } from "./api";
import { logActivity } from "./activity";
import { bookingInclude, bookingLabel, folioFor, type FullBooking } from "./bookings";
import { splitAcross } from "./groups";
import { openSecret } from "./secret-box";
import { createLink, fetchLink, type RazorpayKeys } from "./razorpay";
import { fromPaise, linkReference, methodFromRazorpay, paymentsToRecord, payPagePath, toPaise, type LinkPayment } from "./online-payments";
import type { BillingContext, HotelSettingsRecord } from "./settings";

const OPEN = ["created", "partially_paid"];

/** The hotel's Razorpay keys, or null when online payments through Razorpay are not set up. */
export function razorpayKeys(settings: Pick<HotelSettingsRecord, "razorpayKeyId" | "razorpayKeySecret">): RazorpayKeys | null {
  const keySecret = openSecret(settings.razorpayKeySecret);
  if (!settings.razorpayKeyId || !keySecret) return null;
  return { keyId: settings.razorpayKeyId, keySecret };
}

/** "+919876543210" for Razorpay, or undefined when the number does not look like a phone number. */
export function razorpayContact(phone: string | null | undefined): string | undefined {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

/** This website's own address, for Razorpay to send the guest back to. */
export function siteOrigin(headers: Headers): string {
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (!host) return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";
  const proto = headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * A Razorpay link for `amount` on this booking (for a group, on its first room, paying for all).
 * An open link for the same amount is used again, so pressing twice does not make two links.
 * Null when an old link turns out to be paid already (its payment is then written down).
 */
export async function paymentLinkFor(booking: FullBooking, amount: number, ctx: BillingContext, origin: string, createdBy: string | null) {
  const settings = ctx.settings;
  const keys = razorpayKeys(settings);
  if (!keys) fail("Razorpay is not set up. The owner can add it in Settings → Online payments.");
  const existing = await prisma.paymentLink.findFirst({
    where: { bookingId: booking.id, status: "created", amount },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    // Still open at Razorpay? It may have expired there, or been paid without us hearing:
    // then its payment is written down and a new link is made only if money is still due.
    const remote = await fetchLink(keys, existing.linkId).catch(() => null);
    if (!remote || remote.status === "created") return existing;
    if (await recordLinkPayments(existing, remote, ctx)) return null;
  }
  const link = await createLink(keys, {
    amountPaise: toPaise(amount),
    description: `Booking #${booking.number} at ${settings.hotelName}`,
    reference: linkReference(booking.number, randomBytes(4).toString("hex")),
    customer: { name: `${booking.guest.firstName} ${booking.guest.lastName}`.trim(), contact: razorpayContact(booking.guest.phone) },
    // Back to the booking's payment page, which writes the payment down and says thank you.
    callbackUrl: `${origin}${payPagePath(booking.publicToken)}`,
    // Razorpay needs at least 15 minutes; a week is enough to pay an advance.
    expireBy: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    bookingId: booking.id,
  });
  return prisma.paymentLink.create({
    data: { hotelId: currentHotelId(), bookingId: booking.id, linkId: link.id, shortUrl: link.short_url, amount, status: link.status, createdBy },
  });
}

/**
 * Writes down the captured payments of one link (once each, even when two requests do it at the
 * same moment) and keeps the link's status. A group's payment is shared out over its rooms.
 * Returns how much was newly recorded.
 */
export async function recordLinkPayments(
  link: { id: string; linkId: string; bookingId: string },
  remote: { status: string; payments?: LinkPayment[] | null },
  ctx: BillingContext
): Promise<number> {
  const added = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${link.linkId}))`;
    const booking = await tx.booking.findUnique({ where: { id: link.bookingId }, select: { groupId: true } });
    if (!booking) return [];
    const rooms = await tx.booking.findMany({
      where: booking.groupId ? { groupId: booking.groupId } : { id: link.bookingId },
      include: bookingInclude,
      orderBy: { number: "asc" },
    });
    // The link's own room first, so anything paid beyond the bills stays on it.
    rooms.sort((a, b) => Number(b.id === link.bookingId) - Number(a.id === link.bookingId));
    const recorded = rooms.flatMap((r) => r.payments.map((p) => p.reference));
    const fresh = paymentsToRecord(remote.payments, recorded);
    const balances = new Map(rooms.map((r) => [r.id, folioFor(r, ctx).balance]));
    const out: Array<{ amount: number; method: string; label: string }> = [];
    for (const p of fresh) {
      const shares = splitAcross(
        fromPaise(p.amount),
        rooms.map((r) => ({ id: r.id, balance: balances.get(r.id) ?? 0, status: r.status }))
      );
      for (const share of shares.length ? shares : [{ id: link.bookingId, amount: fromPaise(p.amount) }]) {
        const room = rooms.find((r) => r.id === share.id)!;
        await tx.payment.create({
          data: {
            hotelId: currentHotelId(),
            bookingId: share.id,
            amount: share.amount,
            method: methodFromRazorpay(p.method),
            type: room.status === "reserved" ? "advance" : "balance",
            reference: p.payment_id,
            notes: `Paid online (Razorpay link ${link.linkId})`,
            receivedBy: "Paid online",
            paidAt: new Date(p.created_at * 1000),
          },
        });
        balances.set(share.id, (balances.get(share.id) ?? 0) - share.amount);
        out.push({ amount: share.amount, method: methodFromRazorpay(p.method), label: bookingLabel(room) });
      }
    }
    await tx.paymentLink.update({ where: { id: link.id }, data: { status: remote.status } });
    return out;
  });
  for (const p of added) await logActivity({ id: null, name: "Paid online" }, "Payment received", `${p.label}: ${p.amount} by ${p.method} (Razorpay)`);
  return added.reduce((s, p) => s + p.amount, 0);
}

/**
 * Asks Razorpay about the open links of a booking (or of its whole group) and writes down any
 * payment made through them. Returns how much was newly recorded.
 */
export async function syncPaymentLinks(bookingId: string, ctx: BillingContext): Promise<number> {
  const keys = razorpayKeys(ctx.settings);
  if (!keys) return 0;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { groupId: true } });
  if (!booking) return 0;
  const links = await prisma.paymentLink.findMany({
    where: { status: { in: OPEN }, booking: booking.groupId ? { groupId: booking.groupId } : { id: bookingId } },
  });
  let recorded = 0;
  for (const link of links) {
    const remote = await fetchLink(keys, link.linkId).catch(() => null);
    if (remote) recorded += await recordLinkPayments(link, remote, ctx);
  }
  return recorded;
}

/**
 * Writes down payments made through the hotel's recent open links (for example a guest who paid
 * and closed the page before coming back). Run when the Dashboard or Payments screen opens.
 */
export async function syncRecentLinks(ctx: BillingContext, limit = 20): Promise<number> {
  const keys = razorpayKeys(ctx.settings);
  if (!keys) return 0;
  const since = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  const links = await prisma.paymentLink.findMany({
    where: { status: { in: OPEN }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  let recorded = 0;
  for (const link of links) {
    const remote = await fetchLink(keys, link.linkId).catch(() => null);
    if (remote) recorded += await recordLinkPayments(link, remote, ctx);
  }
  return recorded;
}
