import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withModule } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { pathikRecord } from "@/lib/pathik";
import { addDays, dateFromKey, todayKey } from "@/lib/dates";

/**
 * What the Pathik helper add-on types into Pathik's "Add Guest" form: `?bookingId=` for a stay
 * (guest, room, dates and the other adults), or `?guestId=` for a guest's own details only.
 */
export async function GET(request: NextRequest) {
  return withModule("pathik", async () => {
    const bookingId = request.nextUrl.searchParams.get("bookingId");
    const guestId = request.nextUrl.searchParams.get("guestId");
    const include = { room: true, idChecks: { select: { person: true, idType: true } } } as const;
    const s = await getSettings();
    // From a guest's profile: their stay now (checked in), else the next one due to arrive.
    const booking = bookingId
      ? await prisma.booking.findUnique({ where: { id: bookingId }, include })
      : guestId
        ? ((await prisma.booking.findFirst({ where: { guestId, status: "checked_in" }, orderBy: { checkInDate: "desc" }, include })) ??
          (await prisma.booking.findFirst({ where: { guestId, status: "reserved", checkInDate: { lte: dateFromKey(addDays(todayKey(s.timezone), 1)) } }, orderBy: { checkInDate: "asc" }, include })))
        : null;
    if (bookingId && !booking) fail("Booking not found", 404);
    const guest = await prisma.guest.findUnique({ where: { id: booking?.guestId ?? guestId ?? "" } });
    if (!guest) fail("Guest not found", 404);
    const record = pathikRecord({
      guest,
      booking: booking ? { ...booking, roomNumber: booking.room.roomNumber } : undefined,
      idChecks: booking?.idChecks,
      hotel: { timezone: s.timezone, checkInTime: s.checkInTime, checkOutTime: s.checkOutTime },
    });
    return NextResponse.json({ ...record, bookingId: booking?.id ?? null, pathikAt: booking?.pathikAt ?? null, pathikByName: booking?.pathikByName ?? null });
  });
}
