import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentHotelId, prisma, type Db } from "@/lib/db";
import { withAuth, withAdmin, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { dateFromKey, toDateKey } from "@/lib/dates";
import {
  assertRoomFree,
  bookingLabel,
  checkOutBillingDate,
  checkOutPreview,
  folioFor,
  loadBooking,
  lockRooms,
  parseStayDate,
  serializeBooking,
  syncRoomStatus,
  validateStay,
} from "@/lib/bookings";
import { logActivity } from "@/lib/activity";
import { parseCompanions } from "@/lib/guest-form";
import { BOOKING_SOURCES, GUEST_PAYMENT_METHODS, formatCurrency } from "@/lib/utils";
import { assertOnShift } from "@/lib/shift-api";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const ctx = await getBillingContext();
    const booking = await loadBooking(id);
    const guest = await prisma.guest.findUnique({ where: { id: booking.guestId }, include: { documents: true } });
    // ?checkout=1 adds the bill as it would be at check-out today, so the screen shows exactly what will be charged.
    const query = new URL(request.url).searchParams;
    const wantsCheckout = query.get("checkout") === "1" && booking.status === "checked_in";
    // &gstRate=12 (or =default) previews the bill with another GST % before it is chosen at check-out.
    const gst = query.get("gstRate");
    const gstRate = gst === null ? booking.gstRate : gst === "default" ? null : Number(gst);
    if (gstRate !== null && !(gstRate >= 0 && gstRate <= 40)) fail("Please check the GST %");
    return NextResponse.json({
      ...serializeBooking(booking, ctx),
      guest,
      settings: ctx.settings,
      ...(wantsCheckout && { checkout: checkOutPreview({ ...booking, gstRate }, ctx) }),
    });
  });
}

const editSchema = z.object({
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  roomId: z.string().optional(),
  ratePerNight: z.coerce.number().min(0).optional(),
  fixedRate: z.boolean().optional(),
  discount: z.coerce.number().min(0).optional(),
  gstRate: z.coerce.number().min(0, "GST cannot be less than 0%").max(40, "Please check the GST %").nullable().optional(),
  adults: z.coerce.number().int().min(1).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
  source: z.enum(BOOKING_SOURCES).optional(),
  notes: z.string().optional(),
  otaReference: z.string().trim().max(60).optional(),
  comingFrom: z.string().trim().max(80).optional(),
  goingTo: z.string().trim().max(80).optional(),
  vehicleNumber: z.string().trim().max(20).optional(),
  // The other adults in the room. `was` is the name before this change, so their ID ticks and copies follow a corrected name.
  companions: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Please enter the name of each adult staying").max(80),
        phone: z.string().trim().max(20).optional(),
        aadhaarAtDesk: z.boolean().optional(),
        was: z.string().optional(),
      })
    )
    .max(49)
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
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
      if (body.companions) {
        const names = body.companions.map((c) => c.name.toLowerCase());
        if (new Set(names).size !== names.length) fail("Two adults have the same name. Please add a surname so they can be told apart");
        if (body.companions.length > (body.adults ?? booking.adults) - 1) fail("There are more names than adults. Please change the number of adults first");
      }
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
          ...(body.gstRate !== undefined && { gstRate: body.gstRate }),
          ...(body.adults !== undefined && { adults: body.adults }),
          ...(body.children !== undefined && { children: body.children }),
          ...(body.source && { source: body.source }),
          ...(body.notes !== undefined && { notes: body.notes || null }),
          ...(body.otaReference !== undefined && { otaReference: body.otaReference || null }),
          ...(body.comingFrom !== undefined && { comingFrom: body.comingFrom || null }),
          ...(body.goingTo !== undefined && { goingTo: body.goingTo || null }),
          ...(body.vehicleNumber !== undefined && { vehicleNumber: body.vehicleNumber.toUpperCase() || null }),
          ...(body.companions && {
            companions: body.companions.length
              ? JSON.stringify(body.companions.map((c) => ({ name: c.name, ...(c.phone && { phone: c.phone }), ...(c.aadhaarAtDesk && { aadhaarAtDesk: true }) })))
              : null,
          }),
        },
      });

      if (body.companions) await followRenamedPeople(tx, booking, body.companions);

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

/**
 * ID ticks and ID copies say whose they are by name. When a name is corrected they follow it; the
 * ticks of an adult taken off the booking are removed (their copies stay on the guest's profile).
 */
async function followRenamedPeople(
  tx: Db,
  booking: { id: string; guestId: string; companions: string | null },
  people: { name: string; was?: string }[]
) {
  const before = parseCompanions(booking.companions).map((c) => c.name);
  const renamed = people.filter((p) => p.was && before.includes(p.was) && p.was !== p.name);
  const kept = new Set(people.map((p) => p.was).filter(Boolean));
  const gone = before.filter((n) => !kept.has(n));
  // Look everything up first, so swapping two names does not mix their records up.
  const moves = await Promise.all(
    renamed.map(async (p) => ({
      name: p.name,
      checks: (await tx.idCheck.findMany({ where: { bookingId: booking.id, person: p.was }, select: { id: true } })).map((c) => c.id),
      copies: (await tx.guestDocument.findMany({ where: { guestId: booking.guestId, person: p.was }, select: { id: true } })).map((d) => d.id),
    }))
  );
  if (gone.length) await tx.idCheck.deleteMany({ where: { bookingId: booking.id, person: { in: gone } } });
  for (const m of moves) {
    if (m.checks.length) await tx.idCheck.updateMany({ where: { id: { in: m.checks } }, data: { person: m.name } });
    if (m.copies.length) await tx.guestDocument.updateMany({ where: { id: { in: m.copies } }, data: { person: m.name } });
  }
}

const actionSchema = z.object({
  action: z.enum(["check_in", "check_out", "cancel", "no_show", "undo_check_in"]),
  reason: z.string().optional(),
  // Bill up to the booked leaving date instead of today (early leaver paying in full, or late check-out in the app).
  useBookedDates: z.boolean().optional(),
  // GST % on the room chosen at check-out; null = the default from Settings.
  gstRate: z.coerce.number().min(0, "GST cannot be less than 0%").max(40, "Please check the GST %").nullable().optional(),
  payment: z
    .object({
      amount: z.coerce.number().min(0),
      method: z.enum(GUEST_PAYMENT_METHODS).default("cash"),
      reference: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
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
          const checkOut = checkOutBillingDate(booking, today, !!body.useBookedDates);

          if (body.payment && body.payment.amount > 0) {
            await tx.payment.create({
              data: {
                hotelId: currentHotelId(),
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
            data: {
              status: "checked_out",
              actualCheckOut: new Date(),
              checkOutDate: dateFromKey(checkOut),
              ...(body.gstRate !== undefined && { gstRate: body.gstRate }),
            },
          });
          const fresh = await loadBooking(id, tx);
          const folio = folioFor({ ...fresh, bill: null }, ctx);
          await tx.bill.upsert({
            where: { bookingId: id },
            update: {},
            create: {
              hotelId: currentHotelId(),
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
