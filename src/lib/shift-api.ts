// Shared by the shift API routes.
import type { Shift } from "@prisma/client";
import { currentHotelId } from "./db";
import { logActivity } from "./activity";
import { prisma } from "./db";
import type { SessionUser } from "./session";
import { getSettings } from "./settings";
import { fail } from "./api";
import { END_REASONS, parseSummary, shiftMessage, shiftSummary } from "./shifts";

/** Front-desk staff work in shifts when the owner has it switched on. The owner never has to. */
export async function shiftsRequired(user: SessionUser) {
  if (user.role === "admin") return false;
  return (await getSettings()).staffShifts;
}

/** A shift for the screens: the code to end it is never sent, and an open shift shows its activity so far. */
export async function serializeShift(shift: Shift) {
  const summary = parseSummary(shift.summary) ?? (await shiftSummary({ id: shift.staffId, name: shift.staffName }, shift.startedAt, shift.endedAt ?? new Date()));
  const { endCode: _code, summary: _raw, ...rest } = shift;
  return { ...rest, summary, open: !shift.endedAt };
}

export type ShiftDTO = Awaited<ReturnType<typeof serializeShift>>;

/** The latest handover notes, so whoever starts next reads them first. */
export async function recentHandovers(excludeShiftId?: string) {
  const since = new Date(Date.now() - 48 * 3600 * 1000);
  const rows = await prisma.shift.findMany({
    where: { endedAt: { gte: since }, handoverNote: { not: null }, ...(excludeShiftId && { id: { not: excludeShiftId } }) },
    orderBy: { endedAt: "desc" },
    take: 3,
    select: { id: true, staffName: true, endedAt: true, handoverNote: true, endedBy: true },
  });
  return rows;
}

/**
 * Ends a shift and fixes its summary and report. Notes are written once here and never changed afterwards:
 * no route edits a saved shift.
 */
export async function closeShift(
  shift: Shift,
  how: { reason: "staff" | "owner" | "transferred"; handoverNote?: string; by?: string; at?: Date; handedOverTo?: string; keepTransferId?: string }
) {
  const settings = await getSettings();
  const endedAt = how.at ?? new Date();
  const summary = await shiftSummary({ id: shift.staffId, name: shift.staffName }, shift.startedAt, endedAt);
  const handoverNote = how.handoverNote?.trim() || null;
  const reportText = shiftMessage({
    hotelName: settings.hotelName,
    staffName: shift.staffName,
    startedAt: shift.startedAt,
    endedAt,
    timeZone: settings.timezone,
    summary,
    handoverNote: handoverNote ?? `(none: ${how.handedOverTo ? `handed over to ${how.handedOverTo}` : END_REASONS[how.reason].toLowerCase()})`,
    currency: settings.currency,
  });
  // Only an open shift is updated, so two people ending it at once cannot both write.
  const done = await prisma.shift.updateMany({
    where: { id: shift.id, endedAt: null },
    data: {
      endedAt,
      endCode: null,
      endReason: how.reason,
      endedBy: how.by ?? null,
      handedOverTo: how.handedOverTo ?? null,
      handoverNote,
      summary: JSON.stringify(summary),
      reportText,
      // The owner closing a shift has already seen it.
      ownerSeenAt: how.reason === "owner" ? endedAt : null,
    },
  });
  if (done.count === 0) fail("This shift has already ended");
  // Anyone else waiting to take over this shift no longer needs to.
  await prisma.shiftTransfer.updateMany({
    where: { fromShiftId: shift.id, status: "pending", ...(how.keepTransferId && { id: { not: how.keepTransferId } }) },
    data: { status: "cancelled", respondedAt: endedAt },
  });
  return prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
}

/**
 * Front-desk staff can only change bookings, payments, guests and expenses during their own shift, so every
 * check-in, check-out and payment is counted for the person actually on duty.
 */
export async function assertOnShift(user: SessionUser) {
  if (!(await shiftsRequired(user))) return;
  const open = await prisma.shift.count({ where: { staffId: user.id, endedAt: null } });
  if (!open) fail("Your shift has ended. Please start your shift to continue.", 409);
}

/** Starts a shift for this person, unless they already have one open. */
export async function startShift(user: { id: string; name: string }, startNote: string | null, at = new Date()) {
  const open = await prisma.shift.findFirst({ where: { staffId: user.id, endedAt: null } });
  if (open) return open;
  const shift = await prisma.shift.create({ data: { hotelId: currentHotelId(), staffId: user.id, staffName: user.name, startNote: startNote || null, startedAt: at } });
  await logActivity(user, "Shift started", startNote || undefined);
  return shift;
}

/** Who is on shift now (other than this person), and whether the front desk is full. */
export async function deskStatus(userId: string) {
  const { frontDeskStaff } = await getSettings();
  const onShift = await prisma.shift.findMany({
    where: { endedAt: null, staffId: { not: userId } },
    orderBy: { startedAt: "asc" },
    select: { id: true, staffName: true, startedAt: true },
  });
  return { limit: frontDeskStaff, full: onShift.length >= frontDeskStaff, onShift };
}
