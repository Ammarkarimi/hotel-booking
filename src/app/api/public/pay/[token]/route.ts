import { NextRequest, NextResponse } from "next/server";
import { prisma, rawPrisma, runForHotel } from "@/lib/db";
import { getBillingContext } from "@/lib/settings";
import { bookingInclude, folioFor, groupOf } from "@/lib/bookings";
import { amountToPay, payPagePath } from "@/lib/online-payments";
import { paymentLinkFor, siteOrigin } from "@/lib/payment-links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api";

/**
 * "Pay online" on the guest's payment page: makes (or reuses) a Razorpay link for the amount
 * and sends the guest to it. A form post, so link previews in WhatsApp never make links.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = siteOrigin(request.headers);
  const back = (message?: string) => NextResponse.redirect(`${origin}${payPagePath(token)}${message ? `?e=${encodeURIComponent(message)}` : ""}`, 303);
  if (!rateLimit(`pay:${token}`, 10, 3600_000) || !rateLimit(`pay-ip:${clientIp(request.headers)}`, 30, 3600_000)) {
    return back("Too many tries. Please wait a while and try again.");
  }
  const found = await rawPrisma.booking.findUnique({ where: { publicToken: token }, select: { id: true, hotelId: true, status: true, hotel: { select: { status: true } } } });
  if (!found || found.hotel.status !== "active" || ["cancelled", "no_show"].includes(found.status)) return back();
  const form = await request.formData().catch(() => null);
  try {
    const link = await runForHotel(found.hotelId, async () => {
      const ctx = await getBillingContext();
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: found.id }, include: bookingInclude });
      // Rooms booked together are paid together; the payment is shared out over their bills.
      const group = await groupOf(booking, ctx);
      const amount = amountToPay(group ? group.balance : folioFor(booking, ctx).balance, String(form?.get("a") ?? ""));
      if (amount <= 0) return null;
      return paymentLinkFor(booking, amount, ctx, origin, null);
    });
    return link ? NextResponse.redirect(link.shortUrl, 303) : back();
  } catch (error) {
    return back(error instanceof ApiError ? error.message : "Online payment is not available right now. Please try again later.");
  }
}
