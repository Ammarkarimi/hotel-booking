import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, badRequest } from "@/lib/api";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");

    const payments = await prisma.payment.findMany({
      where: bookingId ? { bookingId } : undefined,
      orderBy: { paidAt: "desc" },
      include: {
        booking: {
          include: { guest: true, room: true },
        },
      },
    });

    return NextResponse.json(payments);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await request.json();
    const { bookingId, amount, method, type, notes } = body;

    if (!bookingId || !amount || !method) {
      return badRequest("Booking ID, amount, and payment method are required");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { bill: true },
    });

    if (!booking) return badRequest("Booking not found");

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount: parseFloat(amount),
        method,
        type: type || "advance",
        status: "completed",
        notes: notes || null,
      },
      include: {
        booking: { include: { guest: true, room: true } },
      },
    });

    return NextResponse.json(payment);
  });
}
