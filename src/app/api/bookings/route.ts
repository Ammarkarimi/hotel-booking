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
import { BOOKING_SOURCES, DOCUMENT_TYPES, GUEST_PAYMENT_METHODS } from "@/lib/utils";
import { assertOnShift } from "@/lib/shift-api";
import { VEHICLE_TYPES, deskPathikMissing, hasOwnVehicle, type GuestFormDetails } from "@/lib/guest-form";
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

const addressFields = z.object({
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Email is not valid").max(120).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional(),
  dateOfBirth: z.string().refine((v) => v === "" || isDateKey(v), "Please check the date of birth").optional(),
  locality: z.string().trim().max(80).optional(),
  city: z.string().trim().max(60).optional(),
  district: z.string().trim().max(60).optional(),
  state: z.string().trim().max(60).optional(),
  pinCode: z.string().trim().max(12).optional(),
});

/** Only the filled-in boxes, ready for the guest's profile. */
function addressData(d: z.infer<typeof addressFields> | undefined) {
  if (!d) return {};
  const out: Record<string, string | Date> = {};
  for (const k of ["lastName", "email", "address", "locality", "city", "district", "state"] as const) if (d[k]) out[k] = d[k]!;
  if (d.pinCode) out.pinCode = d.pinCode.replace(/\s/g, "");
  if (d.dateOfBirth) out.dateOfBirth = dateFromKey(d.dateOfBirth);
  return out;
}

const createSchema = z.object({
  guestId: z.string().optional(),
  // A guest form filled in on WhatsApp: the guest's details and travel details come from it.
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
    })
    .merge(addressFields)
    .optional(),
  // The police register (Pathik) details of a guest chosen from the list: only the boxes filled in change.
  guestDetails: addressFields.optional(),
  // The journey and the other adults, typed at the desk (a guest form brings its own).
  comingFrom: z.string().trim().max(80).optional(),
  goingTo: z.string().trim().max(80).optional(),
  vehicleNumber: z.string().trim().max(20).optional(),
  vehicleType: z.enum(["", ...VEHICLE_TYPES]).optional(),
  companions: z
    .array(z.object({ name: z.string().trim().min(1, "Please enter the name of each adult staying").max(80), phone: z.string().trim().max(20).optional() }))
    .max(49)
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
  // The original IDs the front desk looked at: which kind of ID, per adult (null = the guest who
  // booked). No number or copy is saved. Every adult needs one for a walk-in checked in now.
  idChecks: z
    .array(z.object({ person: z.string().trim().max(80).nullable(), idType: z.enum(["aadhar", ...DOCUMENT_TYPES], { errorMap: () => ({ message: "Please choose which ID you saw" }) }) }))
    .max(50)
    .default([]),
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
    const companions = body.guestFormId ? [] : (body.companions ?? []).filter((c) => c.name);
    if (companions.length > body.adults - 1) fail("There are more names than adults. Please check the number of adults");
    const names = companions.map((c) => c.name.toLowerCase());
    if (new Set(names).size !== names.length) fail("Two adults have the same name. Please add a surname so they can be told apart");

    const booking = await prisma.$transaction(async (tx) => {
      await lockRooms(tx, [body.roomId]);
      const room = await assertRoomFree({ roomId: body.roomId, checkIn, checkOut, today: ctx.today }, tx);

      let guestId = body.guestId;
      const form = body.guestFormId ? await claimGuestForm(tx, body.guestFormId, user.name) : null;
      if (body.checkInNow) {
        const seen = new Set(body.idChecks.map((c) => c.person ?? ""));
        const names = form ? form.details.companions.map((c) => c.name) : companions.map((c) => c.name);
        const unchecked = ["", ...names].filter((n) => !seen.has(n));
        if (unchecked.length || seen.size < body.adults) fail("Please verify the ID of every adult before checking them in");
      }
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
                ...addressData(body.guest),
                idType: body.guest.idType || null,
              },
            })
          ).id;
      }
      // Details typed at the desk for a returning guest fill in their profile.
      const mainCheck = body.idChecks.find((c) => c.person === null);
      const extra = form ? {} : addressData(body.guestId ? body.guestDetails : body.guest);
      if (body.guestId && mainCheck) {
        // The ID seen now becomes the guest's ID type.
        const before = await tx.guest.findUnique({ where: { id: guestId! }, select: { idType: true } });
        if (before && before.idType !== mainCheck.idType) Object.assign(extra, { idType: mainCheck.idType });
      }
      const guest = Object.keys(extra).length
        ? await tx.guest.update({ where: { id: guestId! }, data: extra }).catch(() => null)
        : await tx.guest.findUnique({ where: { id: guestId! } });
      if (!guest) fail("Guest not found", 404);
      // With Pathik switched on, a booking made at the desk needs everything Pathik's form asks for.
      if (!form && ctx.settings.pathik) {
        const missing = deskPathikMissing({
          ...guest,
          comingFrom: body.comingFrom,
          goingTo: body.goingTo,
          vehicleType: body.vehicleType,
          adults: body.adults,
          companions,
        });
        if (missing.length) fail(`Please fill in: ${missing.join(", ")}`);
      }
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
          pricesIncludeTax: ctx.settings.roomPricesIncludeTax,
          notes: body.notes || null,
          otaReference: body.otaReference || null,
          ...(!form && {
            comingFrom: body.comingFrom || null,
            goingTo: body.goingTo || null,
            vehicleType: body.vehicleType || null,
            vehicleNumber: hasOwnVehicle(body.vehicleType) || !body.vehicleType ? body.vehicleNumber?.toUpperCase() || null : null,
            companions: companions.length ? JSON.stringify(companions.map((c) => ({ name: c.name, ...(c.phone && { phone: c.phone }) }))) : null,
          }),
          ...(form && {
            comingFrom: form.details.comingFrom || null,
            goingTo: form.details.goingTo || null,
            vehicleNumber: form.details.vehicleNumber?.toUpperCase() || null,
            vehicleType: form.details.vehicleType || null,
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

      if (body.idChecks.length) {
        await tx.idCheck.createMany({
          data: body.idChecks.map((c) => ({
            hotelId: currentHotelId(),
            bookingId: created.id,
            person: c.person,
            method: "id_seen",
            idType: c.idType,
            checkedById: user.id,
            checkedByName: user.name,
          })),
        });
      }

      if (form) {
        await tx.guestForm.update({ where: { id: form.id }, data: { bookingId: created.id } });
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
  if (claimed.count !== 1) fail("This express check-in has already been used or closed. Please refresh the page.", 409);
  const form = await tx.guestForm.findUniqueOrThrow({ where: { id } });
  const details = parseDetails(form.details);
  if (!details) fail("This express check-in has no details", 409);
  return { id: form.id, details };
}

/**
 * The guest's profile from the form: the chosen returning guest, or the guest with the same
 * phone and first name, is updated; otherwise a new guest is added.
 */
async function guestFromForm(tx: Tx, form: { id: string; details: GuestFormDetails }, chosenId?: string) {
  const d = form.details;
  const data = {
    firstName: d.firstName,
    lastName: d.lastName || "",
    phone: d.phone,
    email: d.email || null,
    nationality: d.nationality || "Indian",
    dateOfBirth: dateFromKey(d.dateOfBirth),
    address: d.address,
    locality: d.locality || null,
    city: d.city,
    district: d.district || null,
    state: d.state || null,
    pinCode: d.pinCode || null,
  };
  const existing = chosenId
    ? await tx.guest.findUnique({ where: { id: chosenId } })
    : await tx.guest.findFirst({ where: { phone: d.phone, firstName: { equals: d.firstName, mode: "insensitive" } } });
  if (chosenId && !existing) fail("Guest not found", 404);
  // The guest said they will show their Aadhaar (checked at the desk, nothing saved).
  const idType = d.aadhaarAtDesk ? "aadhar" : null;
  if (existing) {
    await tx.guest.update({
      where: { id: existing.id },
      data: { ...data, ...(idType && { idType }) },
    });
    return existing.id;
  }
  const created = await tx.guest.create({ data: { ...data, hotelId: currentHotelId(), idType } });
  return created.id;
}
