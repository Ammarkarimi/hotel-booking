import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { withAuth, withAdmin, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { addDays, dateFromKey, isDateKey } from "@/lib/dates";
import { bookingLabel, folioFor, loadBooking, serializeBooking } from "@/lib/bookings";
import { logActivity } from "@/lib/activity";
import { PAYMENT_METHODS, label } from "@/lib/utils";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const method = searchParams.get("method");

    const where: Prisma.PaymentWhereInput = { status: "completed" };
    if (bookingId) where.bookingId = bookingId;
    if (method && method !== "all") where.method = method;
    if (isDateKey(from) || isDateKey(to)) {
      // Payment times are real moments, so widen by a day each side and let the screen filter by local date.
      where.paidAt = {
        ...(isDateKey(from) && { gte: dateFromKey(addDays(from, -1)) }),
        ...(isDateKey(to) && { lt: dateFromKey(addDays(to, 2)) }),
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: 1000,
      include: { booking: { include: { guest: true, room: true } } },
    });
    return NextResponse.json(payments);
  });
}

const paymentSchema = z.object({
  bookingId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be more than zero"),
  method: z.enum(PAYMENT_METHODS),
  type: z.enum(["advance", "balance", "full", "refund"]).optional(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = paymentSchema.parse(await request.json());
    const ctx = await getBillingContext();
    const booking = await loadBooking(body.bookingId);
    const folio = folioFor(booking, ctx);

    let type = body.type;
    if (!type) type = booking.status === "reserved" ? "advance" : "balance";
    if (type === "refund" && body.amount > folio.netPaid + 0.01) {
      fail(`You can refund at most ${folio.netPaid} (the amount received so far)`);
    }

    await prisma.payment.create({
      data: {
        hotelId: currentHotelId(),
        bookingId: body.bookingId,
        amount: body.amount,
        method: body.method,
        type,
        reference: body.reference || null,
        notes: body.notes || null,
        receivedBy: user.name,
      },
    });

    await logActivity(
      user,
      type === "refund" ? "Refund given" : "Payment received",
      `${bookingLabel(booking)}: ${body.amount} by ${label(body.method)}`
    );
    return NextResponse.json(serializeBooking(await loadBooking(body.bookingId), ctx), { status: 201 });
  });
}

export async function DELETE(request: NextRequest) {
  return withAdmin(async (user) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) fail("Payment not specified");
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { booking: { include: { guest: true, room: true } } },
    });
    if (!payment) fail("Payment not found", 404);
    await prisma.payment.delete({ where: { id } });
    await logActivity(user, "Payment deleted", `${bookingLabel(payment.booking)}: ${payment.amount} by ${label(payment.method)}`);
    return NextResponse.json({ success: true });
  });
}
