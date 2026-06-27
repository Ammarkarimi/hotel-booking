import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, badRequest } from "@/lib/api";
import { calculateNights } from "@/lib/utils";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");

    if (bookingId) {
      const bill = await prisma.bill.findUnique({
        where: { bookingId },
        include: {
          booking: {
            include: { guest: true, room: true, payments: true },
          },
        },
      });
      return NextResponse.json(bill);
    }

    const bills = await prisma.bill.findMany({
      orderBy: { generatedAt: "desc" },
      include: {
        booking: {
          include: { guest: true, room: true, payments: true },
        },
      },
    });

    return NextResponse.json(bills);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await request.json();
    const { bookingId, additionalCharges, discount, taxRate } = body;

    if (!bookingId) return badRequest("Booking ID is required");

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true, bill: true },
    });

    if (!booking) return badRequest("Booking not found");
    if (booking.bill) return badRequest("Bill already exists for this booking");

    const checkIn = booking.actualCheckIn || booking.checkInDate;
    const checkOut = booking.actualCheckOut || booking.checkOutDate;
    const nights = calculateNights(checkIn, checkOut);
    const roomCharges = booking.room.pricePerNight * nights;
    const addCharges = parseFloat(additionalCharges) || 0;
    const disc = parseFloat(discount) || 0;
    const tax = parseFloat(taxRate) || 12;
    const subtotal = roomCharges + addCharges - disc;
    const taxAmount = subtotal * (tax / 100);
    const totalAmount = subtotal + taxAmount;

    const bill = await prisma.bill.create({
      data: {
        bookingId,
        roomCharges,
        additionalCharges: addCharges,
        discount: disc,
        taxRate: tax,
        taxAmount,
        totalAmount,
        nights,
      },
      include: {
        booking: { include: { guest: true, room: true, payments: true } },
      },
    });

    return NextResponse.json(bill);
  });
}
