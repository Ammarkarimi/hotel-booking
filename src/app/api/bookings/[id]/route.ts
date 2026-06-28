import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, badRequest, notFound } from "@/lib/api";
import { calculateNights } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        guest: { include: { documents: true } },
        room: true,
        payments: { orderBy: { paidAt: "desc" } },
        bill: true,
      },
    });

    if (!booking) return notFound("Booking not found");
    return NextResponse.json(booking);
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { room: true, payments: true, bill: true },
    });

    if (!booking) return notFound("Booking not found");

    if (action === "check_in") {
      if (booking.status !== "reserved") {
        return badRequest("Only reserved bookings can be checked in");
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: "checked_in",
          actualCheckIn: new Date(),
        },
        include: { guest: true, room: true, payments: true, bill: true },
      });

      await prisma.room.update({
        where: { id: booking.roomId },
        data: { status: "occupied" },
      });

      return NextResponse.json(updated);
    }

    if (action === "check_out") {
      if (booking.status !== "checked_in") {
        return badRequest("Only checked-in bookings can be checked out");
      }

      const checkOut = new Date();
      const checkIn = booking.actualCheckIn || booking.checkInDate;
      const nights = calculateNights(checkIn, checkOut);
      const roomCharges = booking.room.pricePerNight * nights;
      const taxRate = 12;
      const taxAmount = roomCharges * (taxRate / 100);
      const totalAmount = roomCharges + taxAmount;

      const updated = await prisma.$transaction(async (tx) => {
        const checkedOut = await tx.booking.update({
          where: { id },
          data: {
            status: "checked_out",
            actualCheckOut: checkOut,
          },
        });

        await tx.room.update({
          where: { id: booking.roomId },
          data: { status: "available" },
        });

        if (!booking.bill) {
          await tx.bill.create({
            data: {
              bookingId: id,
              roomCharges,
              taxRate,
              taxAmount,
              totalAmount,
              nights,
            },
          });
        }

        return checkedOut;
      });

      const fullBooking = await prisma.booking.findUnique({
        where: { id: updated.id },
        include: { guest: true, room: true, payments: true, bill: true },
      });

      return NextResponse.json(fullBooking);
    }

    if (action === "cancel") {
      if (booking.status === "checked_out") {
        return badRequest("Cannot cancel completed booking");
      }

      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id },
          data: { status: "cancelled" },
        });
        if (booking.status !== "checked_in") {
          await tx.room.update({
            where: { id: booking.roomId },
            data: { status: "available" },
          });
        }
      });

      const fullBooking = await prisma.booking.findUnique({
        where: { id },
        include: { guest: true, room: true, payments: true, bill: true },
      });

      return NextResponse.json(fullBooking);
    }

    if (action === "transfer") {
      const { newRoomId, notes } = body;
      if (!newRoomId) return badRequest("New room is required for transfer");
      if (!["reserved", "checked_in"].includes(booking.status)) {
        return badRequest("Only reserved or checked-in bookings can be transferred");
      }

      const newRoom = await prisma.room.findUnique({ where: { id: newRoomId } });
      if (!newRoom) return badRequest("New room not found");
      if (newRoom.status !== "available") {
        return badRequest("New room is not available");
      }

      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id },
          data: {
            roomId: newRoomId,
            ...(notes !== undefined && { notes }),
          },
        });
        await tx.room.update({
          where: { id: booking.roomId },
          data: { status: "available" },
        });
        await tx.room.update({
          where: { id: newRoomId },
          data: { status: booking.status === "checked_in" ? "occupied" : "reserved" },
        });
      });

      const fullBooking = await prisma.booking.findUnique({
        where: { id },
        include: { guest: true, room: true, payments: true, bill: true },
      });

      return NextResponse.json(fullBooking);
    }

    return badRequest("Invalid action");
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return notFound("Booking not found");

    if (["checked_in", "checked_out"].includes(booking.status)) {
      return badRequest("Can only delete reserved or cancelled bookings");
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.delete({ where: { id } });
      if (booking.status === "reserved") {
        await tx.room.update({
          where: { id: booking.roomId },
          data: { status: "available" },
        });
      }
    });

    return NextResponse.json({ success: true });
  });
}
