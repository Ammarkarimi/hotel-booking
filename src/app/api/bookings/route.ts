import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, badRequest } from "@/lib/api";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const bookings = await prisma.booking.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        guest: true,
        room: true,
        payments: true,
        bill: true,
      },
    });

    return NextResponse.json(bookings);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await request.json();
    const { guestId, roomId, checkInDate, checkOutDate, adults, children, notes } = body;

    if (!guestId || !roomId || !checkInDate || !checkOutDate) {
      return badRequest("Guest, room, check-in and check-out dates are required");
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return badRequest("Room not found");
    if (room.status !== "available") {
      return badRequest("Room is not available");
    }

    const booking = await prisma.booking.create({
      data: {
        guestId,
        roomId,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        adults: adults || 1,
        children: children || 0,
        notes: notes || null,
        status: "reserved",
      },
      include: { guest: true, room: true },
    });

    await prisma.room.update({
      where: { id: roomId },
      data: { status: "reserved" },
    });

    return NextResponse.json(booking);
  });
}
