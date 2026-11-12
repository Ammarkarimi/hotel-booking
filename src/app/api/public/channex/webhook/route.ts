import { after, NextRequest, NextResponse } from "next/server";
import { rawPrisma, runForHotel } from "@/lib/db";
import { getBillingContext, getHotelModules } from "@/lib/settings";
import { channexConfigured, expectedWebhookSecret, pullChannexBookings } from "@/lib/channex-sync";
import { sameSecret, WEBHOOK_HEADER } from "@/lib/channex-map";

/**
 * Channex tells us here, at once, that a booking site sold, changed or cancelled a booking.
 * The message only says "look": the booking itself is read from Channex's list, which is safe
 * against messages that arrive twice or in the wrong order.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    event?: string;
    property_id?: string;
    payload?: { property_id?: string } | null;
  } | null;
  const propertyId = String(body?.property_id || body?.payload?.property_id || "");
  const expected = propertyId ? expectedWebhookSecret(propertyId) : null;
  if (!expected || !sameSecret(request.headers.get(WEBHOOK_HEADER), expected)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const event = String(body?.event ?? "");
  if (!/^(booking|non_acked_booking)/.test(event) || !channexConfigured()) return NextResponse.json({ ok: true, ignored: true });

  const link = await rawPrisma.channexLink.findUnique({ where: { propertyId }, select: { hotelId: true, hotel: { select: { status: true } } } });
  // A hotel that has disconnected, or is paused: nothing to do, and Channex should not try again.
  if (!link || link.hotel.status !== "active") return NextResponse.json({ ok: true, ignored: true });

  const work = () =>
    runForHotel(link.hotelId, async () => {
      if (!(await getHotelModules()).includes("channel_manager")) return;
      await pullChannexBookings(await getBillingContext());
    }).catch((error) => console.error(`Bookings of hotel ${link.hotelId} could not be read from Channex`, error));
  try {
    // Answer Channex at once; read the bookings just after.
    after(work);
  } catch {
    await work();
  }
  return NextResponse.json({ ok: true });
}
