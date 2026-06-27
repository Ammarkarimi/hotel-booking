import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, badRequest, notFound } from "@/lib/api";
import { parseAmenities, stringifyAmenities } from "@/lib/utils";

export async function GET() {
  return withAuth(async () => {
    const rooms = await prisma.room.findMany({
      orderBy: { roomNumber: "asc" },
      include: {
        bookings: {
          where: { status: "checked_in" },
          take: 1,
          include: { guest: true },
        },
      },
    });

    return NextResponse.json(
      rooms.map((room) => ({
        ...room,
        amenities: parseAmenities(room.amenities),
        currentGuest: room.bookings[0]?.guest ?? null,
      }))
    );
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await request.json();
    const { roomNumber, type, pricePerNight, amenities, status } = body;

    if (!roomNumber || !type || !pricePerNight) {
      return badRequest("Room number, type, and price are required");
    }

    const existing = await prisma.room.findUnique({ where: { roomNumber } });
    if (existing) {
      return badRequest("Room number already exists");
    }

    const amenitiesStr = Array.isArray(amenities)
      ? stringifyAmenities(amenities)
      : amenities || "[]";

    const room = await prisma.room.create({
      data: {
        roomNumber,
        type,
        pricePerNight: parseFloat(pricePerNight),
        amenities: amenitiesStr,
        status: status || "available",
      },
    });

    return NextResponse.json({
      ...room,
      amenities: parseAmenities(room.amenities),
    });
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return badRequest("Room ID is required");

    const activeBooking = await prisma.booking.findFirst({
      where: { roomId: id, status: { in: ["checked_in", "reserved"] } },
    });
    if (activeBooking) {
      return badRequest("Cannot delete room with active booking");
    }

    await prisma.room.delete({ where: { id } });
    return NextResponse.json({ success: true });
  });
}
