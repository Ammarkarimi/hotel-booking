import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { bookingInclude, folioFor } from "@/lib/bookings";
import { toDateKey } from "@/lib/dates";
import { noStore, publicHotel } from "@/lib/public";

/** Confirmation page data. Only reachable with the secret token from the booking. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const booking = await prisma.booking.findUnique({ where: { publicToken: token }, include: bookingInclude });
    if (!booking) fail("Booking not found", 404);
    const ctx = await getBillingContext();
    const folio = folioFor(booking, ctx);
    return noStore({
      number: booking.number,
      status: booking.status,
      checkIn: toDateKey(booking.checkInDate),
      checkOut: toDateKey(booking.checkOutDate),
      nights: folio.nightCount,
      roomType: booking.room.type,
      adults: booking.adults,
      children: booking.children,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`.trim(),
      total: folio.grandTotal,
      paid: folio.netPaid,
      balance: folio.balance,
      hotel: publicHotel(ctx.settings),
    });
  } catch (error) {
    return handleError(error);
  }
}
