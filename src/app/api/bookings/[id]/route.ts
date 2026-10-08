import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, withAdmin, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { dateFromKey, toDateKey } from "@/lib/dates";
import {
  assertRoomFree,
  bookingLabel,
  folioFor,
  loadBooking,
  lockRooms,
  parseStayDate,
  serializeBooking,
  syncRoomStatus,
  validateStay,
} from "@/lib/bookings";
import { logActivity } from "@/lib/activity";
import { BOOKING_SOURCES, PAYMENT_METHODS, formatCurrency } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const ctx = await getBillingContext();
    const booking = await loadBooking(id);
    const guest = await prisma.guest.findUnique({ where: { id: booking.guestId }, include: { documents: true } });
    return NextResponse.json({ ...serializeBooking(booking, ctx), guest, settings: ctx.settings });
  });
}

const editSchema = z.object({
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  roomId: z.string().optional(),
  ratePerNight: z.coerce.number().min(0).optional(),
  fixedRate: z.boolean().optional(),
  discount: z.coerce.number().min(0).optional(),
  adults: z.coerce.number().int().min(1).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
  source: z.enum(BOOKING_SOURCES).optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = editSchema.parse(await request.json());
    const ctx = await getBillingContext();

    const updated = await prisma.$transaction(async (tx) => {
      const booking = await loadBooking(id, tx);
      if (!["reserved", "checked_in"].includes(booking.status)) {
        fail("Only upcoming or current stays can be changed");
      }
      const checkIn = body.checkInDate ? parseStayDate(body.checkInDate, "arrival") : toDateKey(booking.checkInDate);
      const checkOut = body.checkOutDate ? parseStayDate(body.checkOutDate, "leaving") : toDateKey(booking.checkOutDate);
      if (booking.status === "checked_in" && checkIn !== toDateKey(booking.checkInDate)) {
        fail("The guest has already arrived, so the arrival date cannot be changed");
      }
      validateStay(checkIn, checkOut);
      const roomId = body.roomId || booking.roomId;
      const roomChanged = roomId !== booking.roomId;
      const datesChanged = checkIn !== toDateKey(booking.checkInDate) || checkOut !== toDateKey(booking.checkOutDate);

      if (roomChanged || datesChanged) {
        await lockRooms(tx, [roomId, booking.roomId]);
        const newRoom = await assertRoomFree({ roomId, checkIn, checkOut, excludeBookingId: id, today: ctx.today }, tx);
        if (roomChanged && booking.status === "checked_in" && newRoom.status === "occupied") {
          fail(`Room ${newRoom.roomNumber} still has a guest inside`);
        }
      }

      let ratePerNight = body.ratePerNight;
      let fixedRate = body.fixedRate;
      if (roomChanged && ratePerNight === undefined && !booking.fixedRate) {
        // Moving to another room uses that room's normal price unless a special price was agreed.
        const newRoom = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
        ratePerNight = newRoom.pricePerNight;
      }
      if (body.ratePerNight !== undefined && body.fixedRate === undefined) fixedRate = true;

      await tx.booking.update({
        where: { id },
        data: {
          checkInDate: dateFromKey(checkIn),
          checkOutDate: dateFromKey(checkOut),
          roomId,
          ...(ratePerNight !== undefined && { ratePerNight }),
          ...(fixedRate !== undefined && { fixedRate }),
          ...(body.discount !== undefined && { discount: body.discount }),
          ...(body.adults !== undefined && { adults: body.adults }),
          ...(body.children !== undefined && { children: body.children }),
          ...(body.source && { source: body.source }),
          ...(body.notes !== undefined && { notes: body.notes || null }),
        },
      });

      if (roomChanged && booking.status === "checked_in") {
        await tx.room.update({ where: { id: booking.roomId }, data: { housekeeping: "dirty" } });
        await syncRoomStatus(booking.roomId, tx);
        await syncRoomStatus(roomId, tx);
      }
      return loadBooking(id, tx);
    });

    const changes = Object.keys(body).join(", ");
    await logActivity(user, "Booking changed", `${bookingLabel(updated)}: ${changes}`);
    return NextResponse.json(serializeBooking(updated, ctx));
  });
}

const actionSchema = z.object({
  action: z.enum(["check_in", "check_out", "cancel", "no_show", "undo_check_in"]),
  reason: z.string().optional(),
  chargeFullStay: z.boolean().optional(),
  payment: z
    .object({
      amount: z.coerce.number().min(0),
      method: z.enum(PAYMENT_METHODS).default("cash"),
      reference: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = actionSchema.parse(await request.json());
    const ctx = await getBillingContext();
    const today = ctx.today;
    let message = "";

    const result = await prisma.$transaction(async (tx) => {
      const booking = await loadBooking(id, tx);
      await lockRooms(tx, [booking.roomId]);

      switch (body.action) {
        case "check_in": {
          if (booking.status !== "reserved") fail("Only booked (not yet arrived) guests can be checked in");
          const room = booking.room;
          if (room.status === "maintenance") fail(`Room ${room.roomNumber} is marked as under repair. Change the room first.`);
          const inHouse = await tx.booking.findFirst({
            where: { roomId: room.id, status: "checked_in", id: { not: id } },
            include: { guest: true },
          });
          if (inHouse) {
            fail(`Room ${room.roomNumber} still has ${inHouse.guest.firstName} ${inHouse.guest.lastName} inside. Check them out or move this guest to another room.`);
          }
          const plannedIn = toDateKey(booking.checkInDate);
          const checkOut = toDateKey(booking.checkOutDate);
          let newCheckIn = plannedIn;
          if (plannedIn > today) {
            // Early arrival: the stay now starts today, if the room is free.
            if (checkOut <= today) fail("This booking's dates are in the future and cannot start today");
            await assertRoomFree({ roomId: room.id, checkIn: today, checkOut, excludeBookingId: id, today }, tx);
            newCheckIn = today;
          }
          await tx.booking.update({
            where: { id },
            data: { status: "checked_in", actualCheckIn: new Date(), checkInDate: dateFromKey(newCheckIn) },
          });
          await syncRoomStatus(room.id, tx);
          message = "Guest checked in";
          break;
        }

        case "undo_check_in": {
          if (booking.status !== "checked_in") fail("This guest is not checked in");
          await tx.booking.update({ where: { id }, data: { status: "reserved", actualCheckIn: null } });
          await syncRoomStatus(booking.roomId, tx);
          message = "Check-in undone";
          break;
        }

        case "check_out": {
          if (booking.status !== "checked_in") fail("Only guests who are staying can be checked out");
          const plannedOut = toDateKey(booking.checkOutDate);
          const leavingEarly = today < plannedOut;
          const checkOut = leavingEarly && body.chargeFullStay ? plannedOut : today;

          if (body.payment && body.payment.amount > 0) {
            await tx.payment.create({
              data: {
                bookingId: id,
                amount: body.payment.amount,
                method: body.payment.method,
                type: "balance",
                reference: body.payment.reference || null,
                receivedBy: user.name,
              },
            });
          }

          await tx.booking.update({
            where: { id },
            data: { status: "checked_out", actualCheckOut: new Date(), checkOutDate: dateFromKey(checkOut) },
          });
          const fresh = await loadBooking(id, tx);
          const folio = folioFor({ ...fresh, bill: null }, ctx);
          await tx.bill.upsert({
            where: { bookingId: id },
            update: {},
            create: {
              bookingId: id,
              invoiceNumber: `${ctx.settings.invoicePrefix}-${booking.number}`,
              roomCharges: folio.roomTotal,
              additionalCharges: folio.extrasTotal,
              discount: folio.discount,
              taxRate: folio.roomTaxRate,
              roomTax: folio.roomTax,
              extrasTax: folio.extrasTax,
              taxAmount: folio.taxTotal,
              totalAmount: folio.grandTotal,
              nights: folio.nightCount,
            },
          });
          await tx.room.update({ where: { id: booking.roomId }, data: { housekeeping: "dirty" } });
          await syncRoomStatus(booking.roomId, tx);
          message = `Guest checked out. Bill total ${formatCurrency(folio.grandTotal, ctx.settings.currency)}`;
          break;
        }

        case "cancel": {
          if (booking.status !== "reserved") {
            fail(booking.status === "checked_in" ? "The guest is staying. Use Check out instead." : "This booking cannot be cancelled");
          }
          await tx.booking.update({ where: { id }, data: { status: "cancelled", cancelReason: body.reason || null } });
          message = "Booking cancelled";
          break;
        }

        case "no_show": {
          if (booking.status !== "reserved") fail("Only booked guests can be marked as not arrived");
          if (toDateKey(booking.checkInDate) > today) fail("You can mark a no-show only on or after the arrival date");
          await tx.booking.update({ where: { id }, data: { status: "no_show", cancelReason: body.reason || null } });
          message = "Marked as did not come";
          break;
        }
      }
      return loadBooking(id, tx);
    });

    await logActivity(user, message.split(".")[0], `${bookingLabel(result)}${body.reason ? ` — ${body.reason}` : ""}`);
    if (body.payment && body.payment.amount > 0) {
      await logActivity(user, "Payment received", `${bookingLabel(result)}: ${body.payment.amount} by ${body.payment.method}`);
    }
    return NextResponse.json({ ...serializeBooking(result, ctx), message });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const booking = await loadBooking(id);
    if (["checked_in", "checked_out"].includes(booking.status)) {
      fail("Stays that have started cannot be deleted. They are kept for your accounts.");
    }
    if (booking.payments.length > 0) {
      fail("This booking has payments recorded. Cancel it instead of deleting it.");
    }
    await prisma.booking.delete({ where: { id } });
    await logActivity(user, "Booking deleted", bookingLabel(booking));
    return NextResponse.json({ success: true });
  });
}
