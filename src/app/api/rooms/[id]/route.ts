import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, withAdmin, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { syncRoomStatus } from "@/lib/bookings";
import { parseAmenities } from "@/lib/utils";
import { amenitiesToString, roomSchema } from "@/lib/rooms";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id },
      include: { bookings: { orderBy: { checkInDate: "desc" }, take: 20, include: { guest: true } } },
    });
    if (!room) fail("Room not found", 404);
    return NextResponse.json({ ...room, amenities: parseAmenities(room.amenities) });
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = roomSchema.partial().parse(await request.json());
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) fail("Room not found", 404);
    if (body.roomNumber && body.roomNumber !== room.roomNumber) {
      const clash = await prisma.room.findFirst({ where: { roomNumber: body.roomNumber } });
      if (clash) fail(`Room ${body.roomNumber} already exists`);
    }
    if (body.status === "maintenance") {
      const inHouse = await prisma.booking.count({ where: { roomId: id, status: "checked_in" } });
      if (inHouse) fail("A guest is staying in this room. Move or check out the guest first.");
    }

    const updated = await prisma.room.update({
      where: { id },
      data: {
        ...(body.roomNumber && { roomNumber: body.roomNumber }),
        ...(body.type && { type: body.type.toLowerCase() }),
        ...(body.floor !== undefined && { floor: body.floor || null }),
        ...(body.capacity !== undefined && { capacity: body.capacity }),
        ...(body.pricePerNight !== undefined && { pricePerNight: body.pricePerNight }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.amenities !== undefined && { amenities: amenitiesToString(body.amenities) }),
        ...(body.status && { status: body.status }),
      },
    });
    if (body.status === "available") await syncRoomStatus(id);
    await logActivity(user, "Room updated", `Room ${updated.roomNumber}`);
    return NextResponse.json({ ...updated, amenities: parseAmenities(updated.amenities) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const room = await prisma.room.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
    if (!room) fail("Room not found", 404);
    if (room._count.bookings > 0) {
      fail("This room has booking history, so it cannot be deleted. Mark it as 'Not usable' instead.");
    }
    await prisma.room.delete({ where: { id } });
    await logActivity(user, "Room deleted", `Room ${room.roomNumber}`);
    return NextResponse.json({ success: true });
  });
}
