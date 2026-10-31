import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { csvResponse, fail, isAdmin, withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, isDateKey, todayKey } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { durationLabel, END_REASONS } from "@/lib/shifts";
import { closeShift, recentHandovers, serializeShift } from "@/lib/shift-api";

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
      const ms = (s: (typeof shifts)[number]) => (s.endedAt ?? new Date()).getTime() - s.startedAt.getTime();
      const hours = (n: number) => Math.round((n / 3600000) * 100) / 100;
      const oldestFirst = [...shifts].reverse();
      const rows: Array<Array<string | number | null | undefined>> = [
        [
          "Date", "Staff", "Started", "Ended", "Time on duty", "Hours", "How the shift ended",
          "Guest check-ins", "Checked in (bookings)", "Guest check-outs", "Checked out (bookings)", "New bookings",
          "Money received", "Cash", "UPI", "Card", "Bank transfer", "Other",
          "Cash paid for expenses", "Cash to hand over", "Note when starting", "Handover note (as saved)", "Closed by",
        ],
        ...oldestFirst.map((s) => [
          todayKey(tz, s.startedAt),
          s.staffName,
          time(s.startedAt),
          s.endedAt ? (todayKey(tz, s.endedAt) === todayKey(tz, s.startedAt) ? time(s.endedAt) : `${todayKey(tz, s.endedAt)} ${time(s.endedAt)}`) : "Still on shift",
          durationLabel(ms(s)),
          hours(ms(s)),
          s.endedAt ? END_REASONS[s.endReason ?? "staff"] : "Still on shift",
          s.summary.checkIns,
          (s.summary.checkInList ?? []).join("; "),
          s.summary.checkOuts,
          (s.summary.checkOutList ?? []).join("; "),
          s.summary.bookingsMade,
          s.summary.received,
          s.summary.byMethod.cash || 0,
          s.summary.byMethod.upi || 0,
          s.summary.byMethod.card || 0,
          s.summary.byMethod.bank_transfer || 0,
          s.summary.byMethod.other || 0,
          s.summary.cashExpenses,
          s.summary.cashInHand,
          s.startNote,
          s.handoverNote,
          s.endedBy,
        ]),
      ];
      // Totals for each person over the period, below the shifts.
      const byStaff = new Map<string, { name: string; shifts: number; days: Set<string>; ms: number; checkIns: number; checkOuts: number; bookings: number; received: number; cash: number }>();
      for (const s of oldestFirst) {
        const key = s.staffId ?? s.staffName;
        const t = byStaff.get(key) ?? { name: s.staffName, shifts: 0, days: new Set<string>(), ms: 0, checkIns: 0, checkOuts: 0, bookings: 0, received: 0, cash: 0 };
        t.shifts += 1;
        t.days.add(todayKey(tz, s.startedAt));
        t.ms += ms(s);
        t.checkIns += s.summary.checkIns;
        t.checkOuts += s.summary.checkOuts;
        t.bookings += s.summary.bookingsMade;
        t.received += s.summary.received;
        t.cash += s.summary.cashInHand;
        byStaff.set(key, t);
      }
      rows.push([], ["Totals by staff"], ["Staff", "Shifts", "Days worked", "Time on duty", "Hours", "Guest check-ins", "Guest check-outs", "New bookings", "Money received", "Cash to hand over"]);
      for (const t of byStaff.values()) {
        rows.push([t.name, t.shifts, t.days.size, durationLabel(t.ms), hours(t.ms), t.checkIns, t.checkOuts, t.bookings, Math.round(t.received * 100) / 100, Math.round(t.cash * 100) / 100]);
      }
      return csvResponse(`staff_report_${from}_to_${to}.csv`, rows);
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
    // The owner sets how many people work at the front desk together. When this shift would go over that,
    // whoever has been on shift the longest is ended now, so a forgotten shift never stays open.
    const settings = await getSettings();
    const others = await prisma.shift.findMany({ where: { endedAt: null, staffId: { not: user.id } }, orderBy: { startedAt: "asc" } });
    const startedAt = new Date();
    for (const other of others.slice(0, Math.max(0, others.length - (settings.frontDeskStaff - 1)))) {
      await closeShift(other, { reason: "next_shift", at: startedAt }).catch(() => undefined);
      await logActivity(user, "Shift ended automatically", `${other.staffName}'s shift ended when ${user.name} started`);
    }
    const shift = await prisma.shift.create({
      data: { hotelId: currentHotelId(), staffId: user.id, staffName: user.name, startNote: body.startNote || null, startedAt },
    });
    await logActivity(user, "Shift started", body.startNote || undefined);
    return NextResponse.json({ ...(await serializeShift(shift)), handovers: await recentHandovers(shift.id) });
  });
}
