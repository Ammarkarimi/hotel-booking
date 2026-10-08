import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, withAdmin, fail } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { dateFromKey, todayKey, toDateKey } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { parseAmenities } from "@/lib/utils";
import { amenitiesToString, roomSchema } from "@/lib/rooms";

export async function GET() {
  return withAuth(async () => {
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const rooms = await prisma.room.findMany({
      orderBy: { roomNumber: "asc" },
      include: {
        bookings: {
          where: {
            OR: [{ status: "checked_in" }, { status: "reserved", checkOutDate: { gt: dateFromKey(today) } }],
          },
          orderBy: { checkInDate: "asc" },
          include: { guest: true },
        },
      },
    });

    return NextResponse.json(
      rooms.map(({ bookings, ...room }) => {
        const current = bookings.find((b) => b.status === "checked_in");
        const next = bookings.find((b) => b.status === "reserved");
        return {
          ...room,
          amenities: parseAmenities(room.amenities),
          currentGuest: current ? { bookingId: current.id, name: `${current.guest.firstName} ${current.guest.lastName}`.trim(), checkOut: toDateKey(current.checkOutDate) } : null,
          nextBooking: next ? { bookingId: next.id, name: `${next.guest.firstName} ${next.guest.lastName}`.trim(), checkIn: toDateKey(next.checkInDate) } : null,
        };
      })
    );
  });
}

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = roomSchema.parse(await request.json());
    const existing = await prisma.room.findUnique({ where: { roomNumber: body.roomNumber } });
    if (existing) fail(`Room ${body.roomNumber} already exists`);

    const room = await prisma.room.create({
      data: {
        roomNumber: body.roomNumber,
        type: body.type.toLowerCase(),
        floor: body.floor || null,
        capacity: body.capacity,
        pricePerNight: body.pricePerNight,
        description: body.description || null,
        amenities: amenitiesToString(body.amenities) ?? "[]",
        status: body.status ?? "available",
      },
    });
    await logActivity(user, "Room added", `Room ${room.roomNumber}`);
    return NextResponse.json({ ...room, amenities: parseAmenities(room.amenities) }, { status: 201 });
  });
}
