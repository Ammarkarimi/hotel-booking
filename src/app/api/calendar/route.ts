import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, dateFromKey, isDateKey, todayKey, toDateKey } from "@/lib/dates";

/** Rooms and bookings for the room calendar (tape chart). */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const start = isDateKey(searchParams.get("start")) ? searchParams.get("start")! : today;
    const days = Math.min(62, Math.max(1, Number(searchParams.get("days")) || 14));
    const end = addDays(start, days);

    const [rooms, bookings] = await Promise.all([
      prisma.room.findMany({ orderBy: { roomNumber: "asc" } }),
      prisma.booking.findMany({
        where: {
          status: { in: ["reserved", "checked_in", "checked_out"] },
          checkInDate: { lt: dateFromKey(end) },
          OR: [{ checkOutDate: { gt: dateFromKey(start) } }, { status: "checked_in" }],
        },
        include: { guest: true },
        orderBy: { checkInDate: "asc" },
      }),
    ]);

    return NextResponse.json({
      start,
      days,
      today,
      rooms: rooms.map((r) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        type: r.type,
        status: r.status,
        housekeeping: r.housekeeping,
        pricePerNight: r.pricePerNight,
      })),
      bookings: bookings.map((b) => {
        let checkOut = toDateKey(b.checkOutDate);
        // Guests staying past their leaving date still fill the room until they check out.
        if (b.status === "checked_in" && checkOut <= today) checkOut = addDays(today, 1);
        return {
          id: b.id,
          number: b.number,
          roomId: b.roomId,
          status: b.status,
          checkIn: toDateKey(b.checkInDate),
          checkOut,
          guestName: `${b.guest.firstName} ${b.guest.lastName}`.trim(),
          source: b.source,
        };
      }),
    });
  });
}
