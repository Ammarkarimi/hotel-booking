// Banquets on the server: loading, numbering, hall locks and clash checks.
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma, type Db } from "./db";
import { fail } from "./api";
import { addDays, dateFromKey, toDateKey } from "./dates";
import { banquetBill, functionsClash, HOLDING_STATUSES } from "./banquet-bill";

export const banquetInclude = {
  hall: true,
  items: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { paidAt: "asc" } },
} satisfies Prisma.BanquetInclude;

export type FullBanquet = Prisma.BanquetGetPayload<{ include: typeof banquetInclude }>;

export function serializeBanquet(b: FullBanquet) {
  return {
    ...b,
    eventDate: toDateKey(b.eventDate),
    followUpOn: b.followUpOn ? toDateKey(b.followUpOn) : null,
    bill: banquetBill(b),
  };
}

export type SerializedBanquet = ReturnType<typeof serializeBanquet>;

export async function loadBanquet(id: string, db: Db = prisma) {
  const banquet = await db.banquet.findUnique({ where: { id }, include: banquetInclude });
  if (!banquet) fail("Function not found", 404);
  return banquet;
}

/** "Function #12 for Rakesh Shah (Crystal Hall, 14 Dec)" for the activity log. */
export function banquetLabel(b: { number: number; customerName: string; eventDate: Date | string; hall?: { name: string } | null }) {
  const day = new Date(b.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return `Function #${b.number} for ${b.customerName} (${b.hall ? `${b.hall.name}, ` : ""}${day})`;
}

/** Only one person at a time can book a hall, so two functions can never be saved into the same slot. */
export async function lockHall(tx: Db, hallId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hall:${hallId}`}))`;
}

export async function nextBanquetNumber(tx: Db) {
  const hotel = await tx.hotel.update({ where: { id: currentHotelId() }, data: { banquetSeq: { increment: 1 } }, select: { banquetSeq: true } });
  return hotel.banquetSeq;
}

/** Functions holding the hall (on hold, confirmed or done) that clash with this date and time. */
export async function hallClashes(db: Db, slot: { hallId: string; date: string; start: string; end: string; exceptId?: string }) {
  const near = await db.banquet.findMany({
    where: {
      hallId: slot.hallId,
      status: { in: HOLDING_STATUSES },
      // A function past midnight can reach into the next day, so look one day either side.
      eventDate: { gte: dateFromKey(addDays(slot.date, -1)), lte: dateFromKey(addDays(slot.date, 1)) },
      ...(slot.exceptId && { id: { not: slot.exceptId } }),
    },
    select: { id: true, number: true, customerName: true, eventDate: true, startTime: true, endTime: true, status: true },
  });
  return near.filter((b) => functionsClash({ date: slot.date, start: slot.start, end: slot.end }, { date: toDateKey(b.eventDate), start: b.startTime, end: b.endTime }));
}

export async function assertHallFree(db: Db, slot: { hallId: string; date: string; start: string; end: string; exceptId?: string }) {
  const clash = (await hallClashes(db, slot))[0];
  if (clash) {
    fail(`The hall is already booked then: function #${clash.number} for ${clash.customerName}, ${clash.startTime}–${clash.endTime} on ${toDateKey(clash.eventDate)}. Choose another time or hall.`, 409);
  }
}
