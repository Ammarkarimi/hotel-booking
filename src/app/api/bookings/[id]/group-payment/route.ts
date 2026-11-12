import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentHotelId, prisma } from "@/lib/db";
import { withAuth, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { bookingInclude, bookingLabel, folioFor, groupOf, loadBooking, lockRooms } from "@/lib/bookings";
import { splitAcross } from "@/lib/groups";
import { logActivity } from "@/lib/activity";
import { GUEST_PAYMENT_METHODS, label } from "@/lib/utils";
import { assertOnShift } from "@/lib/shift-api";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  amount: z.coerce.number().positive("Amount must be more than zero"),
  method: z.enum(GUEST_PAYMENT_METHODS),
  reference: z.string().trim().max(100).optional(),
});

/**
 * One payment for every room booked together: it pays off each room's bill in booking order,
 * and anything more stays on this room. Each room's share is written down on its own bill.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const ctx = await getBillingContext();
    const booking = await loadBooking(id);
    if (!booking.groupId) fail("This booking is for one room. Use Take payment.");

    const shares = await prisma.$transaction(async (tx) => {
      const rooms = await tx.booking.findMany({ where: { groupId: booking.groupId }, include: bookingInclude, orderBy: { number: "asc" } });
      await lockRooms(tx, rooms.map((r) => r.roomId));
      rooms.sort((a, b) => Number(b.id === id) - Number(a.id === id));
      const split = splitAcross(
        body.amount,
        rooms.map((r) => ({ id: r.id, balance: folioFor(r, ctx).balance, status: r.status }))
      );
      if (!split.length) fail("Every room of this group is cancelled, so nothing is due.");
      for (const share of split) {
        const room = rooms.find((r) => r.id === share.id)!;
        await tx.payment.create({
          data: {
            hotelId: currentHotelId(),
            bookingId: share.id,
            amount: share.amount,
            method: body.method,
            type: room.status === "reserved" ? "advance" : "balance",
            reference: body.reference || null,
            notes: `Group payment of ${body.amount}`,
            receivedBy: user.name,
          },
        });
      }
      return split.map((s) => ({ ...s, label: bookingLabel(rooms.find((r) => r.id === s.id)!) }));
    });

    await logActivity(user, "Payment received", `Group of booking #${booking.number}: ${body.amount} by ${label(body.method)} (${shares.map((s) => `${s.label} ${s.amount}`).join("; ")})`);
    return NextResponse.json({ group: await groupOf(booking, ctx) }, { status: 201 });
  });
}
