import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma, type Db } from "./db";
import { addDays, dateFromKey, isDateKey, nightsBetween, rangesOverlap, toDateKey } from "./dates";
import { computeFolio, priceNights, round2, type Folio } from "./pricing";
import type { BillingContext } from "./settings";
import { fail } from "./api";

export const ACTIVE_STATUSES = ["reserved", "checked_in"];

export const bookingInclude = {
  guest: true,
  room: true,
  payments: { orderBy: { paidAt: "asc" } },
  charges: { orderBy: { date: "asc" } },
  bill: true,
} satisfies Prisma.BookingInclude;

export type FullBooking = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/** Parses a date from a form ("YYYY-MM-DD" or a full ISO date). */
export function parseStayDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) fail(`Please choose the ${label} date`);
  const key = isDateKey(value) ? value : Number.isNaN(Date.parse(value)) ? null : toDateKey(value);
  if (!key) fail(`The ${label} date is not valid`);
  return key;
}

export function validateStay(checkIn: string, checkOut: string) {
  if (checkOut <= checkIn) fail("The leaving date must be after the arrival date");
  if (nightsBetween(checkIn, checkOut) > 365) fail("A booking cannot be longer than 365 nights");
}

/**
 * A guest who is still checked in after their planned leaving date keeps the
 * room until they actually check out, so treat their stay as running to tomorrow.
 * A guest leaving today does not block tonight: the room can be sold again.
 */
function effectiveCheckOut(b: { status: string; checkOutDate: Date }, today: string) {
  const out = toDateKey(b.checkOutDate);
  if (b.status === "checked_in" && out < today) return addDays(today, 1);
  return out;
}

export async function findConflicts(
  opts: { roomIds?: string[]; checkIn: string; checkOut: string; excludeBookingId?: string; today: string },
  db: Db = prisma
) {
  const candidates = await db.booking.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      checkInDate: { lt: dateFromKey(opts.checkOut) },
      ...(opts.roomIds && { roomId: { in: opts.roomIds } }),
      ...(opts.excludeBookingId && { id: { not: opts.excludeBookingId } }),
    },
    include: { guest: true },
  });
  return candidates.filter((b) =>
    rangesOverlap(toDateKey(b.checkInDate), effectiveCheckOut(b, opts.today), opts.checkIn, opts.checkOut)
  );
}

export async function assertRoomFree(
  opts: { roomId: string; checkIn: string; checkOut: string; excludeBookingId?: string; today: string },
  db: Db = prisma
) {
  const room = await db.room.findUnique({ where: { id: opts.roomId } });
  if (!room) fail("Room not found", 404);
  if (room.status === "maintenance") fail(`Room ${room.roomNumber} is under maintenance and cannot be booked`);
  const conflicts = await findConflicts({ ...opts, roomIds: [opts.roomId] }, db);
  if (conflicts.length > 0) {
    const c = conflicts[0];
    fail(
      `Room ${room.roomNumber} is already booked by ${c.guest.firstName} ${c.guest.lastName} ` +
        `(booking #${c.number}) for some of these dates. Please choose another room or dates.`,
      409
    );
  }
  return room;
}

/** Rooms that are free for the whole stay, with a price quote for each. */
export async function findAvailableRooms(
  ctx: BillingContext,
  opts: { checkIn: string; checkOut: string; excludeBookingId?: string; guests?: number }
) {
  const [rooms, conflicts] = await Promise.all([
    prisma.room.findMany({ where: { status: { not: "maintenance" } }, orderBy: { roomNumber: "asc" } }),
    findConflicts({ ...opts, today: ctx.today }),
  ]);
  const busy = new Set(conflicts.map((c) => c.roomId));
  return rooms
    .filter((r) => !busy.has(r.id))
    .filter((r) => !opts.guests || r.capacity >= opts.guests)
    .map((room) => {
      const nights = priceNights({
        baseRate: room.pricePerNight,
        checkIn: opts.checkIn,
        checkOut: opts.checkOut,
        roomType: room.type,
        rules: ctx.rules,
      });
      const quote = computeFolio({ nights, discount: 0, charges: [], payments: [], tax: ctx.tax });
      return { room, quote };
    });
}

/** The live bill for a booking. Checked-out bookings use the frozen invoice. */
export function folioFor(booking: FullBooking, ctx: BillingContext): Folio {
  const nights = priceNights({
    baseRate: booking.ratePerNight || booking.room.pricePerNight,
    checkIn: booking.checkInDate,
    checkOut: booking.checkOutDate,
    roomType: booking.room.type,
    fixedRate: booking.fixedRate,
    rules: ctx.rules,
  });
  const live = computeFolio({
    nights,
    discount: booking.discount,
    charges: booking.charges,
    payments: booking.payments,
    tax: ctx.tax,
  });
  const bill = booking.bill;
  if (!bill) return live;

  const roomAfterDiscount = round2(bill.roomCharges - bill.discount);
  return {
    ...live,
    nightCount: bill.nights,
    roomTotal: bill.roomCharges,
    discount: bill.discount,
    roomAfterDiscount,
    roomTaxRate: bill.taxRate,
    roomTax: bill.roomTax,
    extrasTotal: bill.additionalCharges,
    extrasTax: bill.extrasTax,
    extrasTaxRate: bill.additionalCharges > 0 ? round2((bill.extrasTax / bill.additionalCharges) * 100) : live.extrasTaxRate,
    taxTotal: bill.taxAmount,
    grandTotal: bill.totalAmount,
    balance: round2(bill.totalAmount - live.netPaid),
  };
}

export function serializeBooking(booking: FullBooking, ctx: BillingContext) {
  const folio = folioFor(booking, ctx);
  const checkIn = toDateKey(booking.checkInDate);
  const checkOut = toDateKey(booking.checkOutDate);
  return {
    ...booking,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`.trim(),
    folio,
    flags: {
      arrivingToday: booking.status === "reserved" && checkIn === ctx.today,
      lateArrival: booking.status === "reserved" && checkIn < ctx.today,
      leavingToday: booking.status === "checked_in" && checkOut === ctx.today,
      overstay: booking.status === "checked_in" && checkOut < ctx.today,
    },
  };
}

export type SerializedBooking = ReturnType<typeof serializeBooking>;

export async function loadBooking(id: string, db: Db = prisma) {
  const booking = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) fail("Booking not found", 404);
  return booking;
}

/** Keeps the room's stored status in step with who is actually in it. */
export async function syncRoomStatus(roomId: string, db: Db = prisma) {
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room || room.status === "maintenance") return;
  const inHouse = await db.booking.count({ where: { roomId, status: "checked_in" } });
  const status = inHouse > 0 ? "occupied" : "available";
  if (room.status !== status) await db.room.update({ where: { id: roomId }, data: { status } });
}

export function bookingLabel(b: { number: number; guest?: { firstName: string; lastName: string } | null; room?: { roomNumber: string } | null }) {
  const guest = b.guest ? ` for ${b.guest.firstName} ${b.guest.lastName}`.trimEnd() : "";
  const room = b.room ? ` (Room ${b.room.roomNumber})` : "";
  return `#${b.number}${guest}${room}`;
}

/**
 * Serialises booking changes per room inside a transaction so two people
 * booking the same room at the same moment cannot both succeed.
 */
export async function lockRooms(tx: Db, roomIds: string[]) {
  for (const id of [...new Set(roomIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
  }
}

/** Hands out the hotel's next booking number (1001, 1002, ...). Call inside the booking's transaction. */
export async function nextBookingNumber(tx: Db) {
  const hotel = await tx.hotel.update({
    where: { id: currentHotelId() },
    data: { bookingSeq: { increment: 1 } },
    select: { bookingSeq: true },
  });
  return hotel.bookingSeq;
}
