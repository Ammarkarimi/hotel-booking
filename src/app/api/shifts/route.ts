import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { csvResponse, fail, isAdmin, withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, isDateKey, todayKey } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { durationLabel } from "@/lib/shifts";
import { recentHandovers, serializeShift } from "@/lib/shift-api";

/** Attendance: shifts that started in a date range (hotel's own days). The owner sees everyone; staff see their own. */
export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const { searchParams } = new URL(request.url);
    const settings = await getSettings();
    const tz = settings.timezone;
    const today = todayKey(tz);
    const to = isDateKey(searchParams.get("to")) ? searchParams.get("to")! : today;
    const from = isDateKey(searchParams.get("from")) ? searchParams.get("from")! : `${to.slice(0, 7)}-01`;
    if (to < from) fail("The end date must be after the start date");

    // Who is on shift right now, whenever they started.
    if (searchParams.get("open") === "1") {
      const open = await prisma.shift.findMany({ where: { endedAt: null, ...(!isAdmin(user) && { staffId: user.id }) }, orderBy: { startedAt: "asc" } });
      return NextResponse.json(await Promise.all(open.map(serializeShift)));
    }

    // Timestamps are widened by a day each side, then sorted into the hotel's local days.
    const where: Prisma.ShiftWhereInput = {
      startedAt: { gte: new Date(`${addDays(from, -1)}T00:00:00Z`), lt: new Date(`${addDays(to, 2)}T00:00:00Z`) },
    };
    if (!isAdmin(user)) where.staffId = user.id;
    else if (searchParams.get("staffId")) where.staffId = searchParams.get("staffId");
    const rows = (await prisma.shift.findMany({ where, orderBy: { startedAt: "desc" }, take: 2000 })).filter((s) => {
      const day = todayKey(tz, s.startedAt);
      return day >= from && day <= to;
    });
    const shifts = await Promise.all(rows.map(serializeShift));

    if (searchParams.get("format") === "csv") {
      const time = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(d) : "");
      return csvResponse(`staff_shifts_${from}_to_${to}.csv`, [
        ["Date", "Staff", "Started", "Ended", "Hours", "Guest check-ins", "Guest check-outs", "New bookings", "Money received", "Cash received", "Cash paid for expenses", "Cash to hand over", "Note when starting", "Handover note", "Closed by"],
        ...shifts.map((s) => [
          todayKey(tz, s.startedAt),
          s.staffName,
          time(s.startedAt),
          s.endedAt ? time(s.endedAt) : "Still on shift",
          durationLabel((s.endedAt ?? new Date()).getTime() - s.startedAt.getTime()),
          s.summary.checkIns,
          s.summary.checkOuts,
          s.summary.bookingsMade,
          s.summary.received,
          s.summary.byMethod.cash || 0,
          s.summary.cashExpenses,
          s.summary.cashInHand,
          s.startNote,
          s.handoverNote,
          s.endedBy,
        ]),
      ]);
    }

    // Opening the list is how the owner reads new shift reports.
    if (isAdmin(user) && searchParams.get("markSeen") === "1") {
      await prisma.shift.updateMany({ where: { endedAt: { not: null }, ownerSeenAt: null }, data: { ownerSeenAt: new Date() } });
    }
    const staff = isAdmin(user) ? await prisma.staff.findMany({ where: { role: "staff" }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }) : [];
    return NextResponse.json({ from, to, shifts, staff });
  });
}

const startSchema = z.object({ startNote: z.string().trim().max(1000).optional().default("") });

/** Start a shift. Starting again while a shift is open returns that shift. */
export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = startSchema.parse(await request.json().catch(() => ({})));
    const open = await prisma.shift.findFirst({ where: { staffId: user.id, endedAt: null } });
    if (open) return NextResponse.json(await serializeShift(open));
    const shift = await prisma.shift.create({
      data: { hotelId: currentHotelId(), staffId: user.id, staffName: user.name, startNote: body.startNote || null },
    });
    await logActivity(user, "Shift started", body.startNote || undefined);
    return NextResponse.json({ ...(await serializeShift(shift)), handovers: await recentHandovers(shift.id) });
  });
}
