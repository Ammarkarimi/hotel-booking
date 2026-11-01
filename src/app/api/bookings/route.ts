import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { withAuth, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { dateFromKey, isDateKey } from "@/lib/dates";
import {
  assertRoomFree,
  bookingInclude,
  bookingLabel,
  lockRooms,
  nextBookingNumber,
  parseStayDate,
  serializeBooking,
  syncRoomStatus,
  validateStay,
} from "@/lib/bookings";
import { logActivity } from "@/lib/activity";
import { BOOKING_SOURCES, GUEST_PAYMENT_METHODS } from "@/lib/utils";
import { assertOnShift } from "@/lib/shift-api";
import type { GuestFormDetails } from "@/lib/guest-form";
import { parseDetails } from "@/lib/guest-forms-api";

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
      result = result.filter((b) => (b.status === "checked_in" || b.status === "checked_out") && b.folio.balance > 0.5);
    }
    return NextResponse.json(result);
  });
}

const createSchema = z.object({
  guestId: z.string().optional(),
  // A guest form filled in on WhatsApp: the guest's details, ID copies and travel details come from it.
  guestFormId: z.string().optional(),
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
  // GST % on the room for this booking; left out or null = the default from Settings.
  gstRate: z.coerce.number().min(0, "GST cannot be less than 0%").max(40, "Please check the GST %").nullable().optional(),
  notes: z.string().trim().optional(),
  otaReference: z.string().trim().max(60).optional(),
  checkInNow: z.boolean().optional(),
  advance: z
    .object({
      amount: z.coerce.number().min(0),
      method: z.enum(GUEST_PAYMENT_METHODS).default("cash"),
      reference: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const body = createSchema.parse(await request.json());
    const ctx = await getBillingContext();
    const checkIn = parseStayDate(body.checkInDate, "arrival");
    const checkOut = parseStayDate(body.checkOutDate, "leaving");
    validateStay(checkIn, checkOut);
    if (body.checkInNow && checkIn !== ctx.today) {
      fail("A guest can only be checked in now if the arrival date is today");
    }
    if (!body.guestId && !body.guest && !body.guestFormId) fail("Please choose or add a guest");

    const booking = await prisma.$transaction(async (tx) => {
      await lockRooms(tx, [body.roomId]);
      const room = await assertRoomFree({ roomId: body.roomId, checkIn, checkOut, today: ctx.today }, tx);

      let guestId = body.guestId;
      const form = body.guestFormId ? await claimGuestForm(tx, body.guestFormId, user.name) : null;
      if (form) guestId = await guestFromForm(tx, form, guestId);
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
                hotelId: currentHotelId(),
                firstName: body.guest.firstName,
                lastName: body.guest.lastName || "",
                phone: body.guest.phone,
                email: body.guest.email || null,
                nationality: body.guest.nationality || "Indian",
                address: body.guest.address || null,
                idType: body.guest.idType || null,
                // Nothing from an Aadhaar is saved: it is checked by scanning its QR code at check-in.
                idNumber: body.guest.idType === "aadhar" ? null : body.guest.idNumber || null,
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
          hotelId: currentHotelId(),
          number: await nextBookingNumber(tx),
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
          gstRate: body.gstRate ?? null,
          notes: body.notes || null,
          otaReference: body.otaReference || null,
          ...(form && {
            comingFrom: form.details.comingFrom || null,
            goingTo: form.details.goingTo || null,
            vehicleNumber: form.details.vehicleNumber?.toUpperCase() || null,
            companions: form.details.companions.length
              ? JSON.stringify(
                  form.details.companions.map((c) => ({ name: c.name, ...(c.phone && { phone: c.phone }), ...(c.aadhaarAtDesk && { aadhaarAtDesk: true }) }))
                )
              : null,
          }),
          createdById: user.id,
          status: body.checkInNow ? "checked_in" : "reserved",
          actualCheckIn: body.checkInNow ? new Date() : null,
        },
      });

      if (body.advance && body.advance.amount > 0) {
        await tx.payment.create({
          data: {
            hotelId: currentHotelId(),
            bookingId: created.id,
            amount: body.advance.amount,
            method: body.advance.method,
            type: "advance",
            reference: body.advance.reference || null,
            receivedBy: user.name,
          },
        });
      }

      if (form) {
        await tx.guestForm.update({ where: { id: form.id }, data: { bookingId: created.id } });
        await tx.guestDocument.updateMany({ where: { guestFormId: form.id }, data: { guestId: guest.id } });
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

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Marks a filled-in guest form as used, so two people can never make two bookings from it. */
async function claimGuestForm(tx: Tx, id: string, by: string) {
  const claimed = await tx.guestForm.updateMany({ where: { id, status: "submitted" }, data: { status: "booked", closedAt: new Date(), closedBy: by } });
  if (claimed.count !== 1) fail("This guest form has already been used or closed. Please refresh the page.", 409);
  const form = await tx.guestForm.findUniqueOrThrow({ where: { id } });
  const details = parseDetails(form.details);
  if (!details) fail("This guest form has no details", 409);
  return { id: form.id, details };
}

/**
 * The guest's profile from the form: the chosen returning guest, or the guest with the same
 * phone and first name, is updated; otherwise a new guest is added.
 */
async function guestFromForm(tx: Tx, form: { id: string; details: GuestFormDetails }, chosenId?: string) {
  const d = form.details;
  const proof = await tx.guestDocument.findFirst({ where: { guestFormId: form.id, person: null }, orderBy: { createdAt: "asc" } });
  const data = {
    firstName: d.firstName,
    lastName: d.lastName || "",
    phone: d.phone,
    email: d.email || null,
    nationality: d.nationality || "Indian",
    dateOfBirth: dateFromKey(d.dateOfBirth),
    address: d.address,
    city: d.city,
    state: d.state || null,
    pinCode: d.pinCode || null,
  };
  const existing = chosenId
    ? await tx.guest.findUnique({ where: { id: chosenId } })
    : await tx.guest.findFirst({ where: { phone: d.phone, firstName: { equals: d.firstName, mode: "insensitive" } } });
  if (chosenId && !existing) fail("Guest not found", 404);
  // The guest's ID: their Aadhaar (checked with its QR code at check-in, nothing saved) or the copy they uploaded.
  const idType = d.aadhaarAtDesk ? "aadhar" : (proof?.type ?? null);
  if (existing) {
    await tx.guest.update({
      where: { id: existing.id },
      // The ID number saved before belongs to the old proof, so it goes when the proof changes.
      data: { ...data, ...(idType && idType !== existing.idType && { idType, idNumber: null }), ...(idType === "aadhar" && { idNumber: null }) },
    });
    return existing.id;
  }
  const created = await tx.guest.create({ data: { ...data, hotelId: currentHotelId(), idType } });
  return created.id;
}
