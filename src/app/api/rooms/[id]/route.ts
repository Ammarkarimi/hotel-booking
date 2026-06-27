import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, badRequest, notFound } from "@/lib/api";
import { parseAmenities, stringifyAmenities } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { guest: true },
        },
      },
    });

    if (!room) return notFound("Room not found");

    return NextResponse.json({
      ...room,
      amenities: parseAmenities(room.amenities),
    });
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const body = await request.json();
    const { roomNumber, type, pricePerNight, amenities, status } = body;

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return notFound("Room not found");

    const amenitiesStr = amenities
      ? Array.isArray(amenities)
        ? stringifyAmenities(amenities)
        : amenities
      : undefined;

    const updated = await prisma.room.update({
      where: { id },
      data: {
        ...(roomNumber && { roomNumber }),
        ...(type && { type }),
        ...(pricePerNight !== undefined && { pricePerNight: parseFloat(pricePerNight) }),
        ...(amenitiesStr && { amenities: amenitiesStr }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({
      ...updated,
      amenities: parseAmenities(updated.amenities),
    });
  });
}
