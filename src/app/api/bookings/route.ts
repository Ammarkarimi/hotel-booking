import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withAuth, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { dateFromKey, isDateKey } from "@/lib/dates";
import {
  assertRoomFree,
  bookingInclude,
  bookingLabel,
  lockRooms,
  parseStayDate,
  serializeBooking,
  syncRoomStatus,
  validateStay,
} from "@/lib/bookings";
import { logActivity } from "@/lib/activity";
import { BOOKING_SOURCES, PAYMENT_METHODS } from "@/lib/utils";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim();
    const guestId = searchParams.get("guestId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const view = searchParams.get("view"); // upcoming | in_house | past | unpaid
    const ctx = await getBillingContext();

    const where: Prisma.BookingWhereInput = {};
    if (status && status !== "all") where.status = { in: status.split(",") };
    if (guestId) where.guestId = guestId;
    if (isDateKey(from)) where.checkOutDate = { gte: dateFromKey(from) };
    if (isDateKey(to)) where.checkInDate = { lte: dateFromKey(to) };
    if (view === "upcoming") where.status = "reserved";
    if (view === "in_house") where.status = "checked_in";
    if (view === "past") where.status = { in: ["checked_out", "cancelled", "no_show"] };
    if (q) {
      const num = Number(q.replace(/^#/, ""));
      where.OR = [
        { guest: { firstName: { contains: q, mode: "insensitive" } } },
        { guest: { lastName: { contains: q, mode: "insensitive" } } },
        { guest: { phone: { contains: q } } },
        { room: { roomNumber: { equals: q } } },
        ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
      ];
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: view === "upcoming" ? { checkInDate: "asc" } : { checkInDate: "desc" },
      include: bookingInclude,
      take: 500,
    });

    let result = bookings.map((b) => serializeBooking(b, ctx));
    if (view === "unpaid") {
      result = result.filter((b) => b.status !== "cancelled" && b.status !== "no_show" && b.folio.balance > 0.5);
    }
    return NextResponse.json(result);
  });
}

const createSchema = z.object({
  guestId: z.string().optional(),
  guest: z
    .object({
      firstName: z.string().trim().min(1, "Guest name is required"),
      lastName: z.string().trim().optional().default(""),
      phone: z.string().trim().min(5, "Please enter a valid phone number"),
      email: z.string().trim().email("Email is not valid").optional().or(z.literal("")),
      nationality: z.string().trim().optional(),
      address: z.string().trim().optional(),
      idType: z.string().optional(),
      idNumber: z.string().trim().optional(),
    })
    .optional(),
  roomId: z.string().min(1, "Please choose a room"),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  adults: z.coerce.number().int().min(1).max(50).default(1),
  children: z.coerce.number().int().min(0).max(50).default(0),
  source: z.enum(BOOKING_SOURCES).default("walk_in"),
  ratePerNight: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional(),
  checkInNow: z.boolean().optional(),
  advance: z
    .object({
      amount: z.coerce.number().min(0),
      method: z.enum(PAYMENT_METHODS).default("cash"),
      reference: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = createSchema.parse(await request.json());
    const ctx = await getBillingContext();
    const checkIn = parseStayDate(body.checkInDate, "arrival");
    const checkOut = parseStayDate(body.checkOutDate, "leaving");
    validateStay(checkIn, checkOut);
    if (body.checkInNow && checkIn !== ctx.today) {
      fail("A guest can only be checked in now if the arrival date is today");
    }
    if (!body.guestId && !body.guest) fail("Please choose or add a guest");

    const booking = await prisma.$transaction(async (tx) => {
      await lockRooms(tx, [body.roomId]);
      const room = await assertRoomFree({ roomId: body.roomId, checkIn, checkOut, today: ctx.today }, tx);

      let guestId = body.guestId;
      if (!guestId && body.guest) {
        // Reuse the existing guest record for a returning guest with the same phone and name.
        const existing = await tx.guest.findFirst({
          where: {
            phone: body.guest.phone,
            firstName: { equals: body.guest.firstName, mode: "insensitive" },
          },
        });
        guestId =
          existing?.id ??
          (
            await tx.guest.create({
              data: {
                firstName: body.guest.firstName,
                lastName: body.guest.lastName || "",
                phone: body.guest.phone,
                email: body.guest.email || null,
                nationality: body.guest.nationality || "Indian",
                address: body.guest.address || null,
                idType: body.guest.idType || null,
                idNumber: body.guest.idNumber || null,
              },
            })
          ).id;
      }
      const guest = await tx.guest.findUnique({ where: { id: guestId! } });
      if (!guest) fail("Guest not found", 404);
      if (body.checkInNow && room.status === "occupied") {
        fail(`Room ${room.roomNumber} still has a guest inside. Check them out first.`);
      }

      const created = await tx.booking.create({
        data: {
          guestId: guest.id,
          roomId: room.id,
          checkInDate: dateFromKey(checkIn),
          checkOutDate: dateFromKey(checkOut),
          adults: body.adults,
          children: body.children,
          source: body.source,
          ratePerNight: body.ratePerNight ?? room.pricePerNight,
          fixedRate: body.ratePerNight !== undefined && body.ratePerNight !== room.pricePerNight,
          discount: body.discount,
          notes: body.notes || null,
          createdById: user.id,
          status: body.checkInNow ? "checked_in" : "reserved",
          actualCheckIn: body.checkInNow ? new Date() : null,
        },
      });

      if (body.advance && body.advance.amount > 0) {
        await tx.payment.create({
          data: {
            bookingId: created.id,
            amount: body.advance.amount,
            method: body.advance.method,
            type: "advance",
            reference: body.advance.reference || null,
            receivedBy: user.name,
          },
        });
      }

      if (body.checkInNow) await syncRoomStatus(room.id, tx);
      return tx.booking.findUniqueOrThrow({ where: { id: created.id }, include: bookingInclude });
    });

    await logActivity(
      user,
      body.checkInNow ? "Walk-in checked in" : "New booking",
      `${bookingLabel(booking)}, ${checkIn} to ${checkOut}`
    );
    if (body.advance && body.advance.amount > 0) {
      await logActivity(user, "Payment received", `${bookingLabel(booking)}: ${body.advance.amount} by ${body.advance.method}`);
    }
    return NextResponse.json(serializeBooking(booking, ctx), { status: 201 });
  });
}
