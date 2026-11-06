import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { toDateKey } from "@/lib/dates";

/** Quick search box: find guests, bookings and rooms by name, phone or number. */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const q = (new URL(request.url).searchParams.get("q") || "").trim();
    if (q.length < 1) return NextResponse.json({ guests: [], bookings: [], rooms: [] });
    const num = Number(q.replace(/^#/, ""));

    const [guests, bookings, rooms] = await Promise.all([
      prisma.guest.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        },
        take: 6,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.booking.findMany({
        where: {
          OR: [
            ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
            { guest: { firstName: { contains: q, mode: "insensitive" as const } } },
            { guest: { lastName: { contains: q, mode: "insensitive" as const } } },
            { guest: { phone: { contains: q } } },
          ],
        },
        take: 6,
        orderBy: { checkInDate: "desc" },
        include: { guest: true, room: true },
      }),
      prisma.room.findMany({ where: { roomNumber: { startsWith: q } }, take: 4 }),
    ]);

    return NextResponse.json({
      guests: guests.map((g) => ({ id: g.id, name: `${g.firstName} ${g.lastName}`.trim(), phone: g.phone })),
      bookings: bookings.map((b) => ({
        id: b.id,
        number: b.number,
        guestName: `${b.guest.firstName} ${b.guest.lastName}`.trim(),
        room: b.room.roomNumber,
        status: b.status,
        checkIn: toDateKey(b.checkInDate),
        checkOut: toDateKey(b.checkOutDate),
      })),
      rooms: rooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber, type: r.type })),
    });
  });
}
