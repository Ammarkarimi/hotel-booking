import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, isAdmin } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { addDays, dateFromKey, todayKey } from "@/lib/dates";
import { bookingInclude, serializeBooking } from "@/lib/bookings";
import { round2 } from "@/lib/pricing";

/** Everything the front desk needs for "Today" in one request. */
export async function GET() {
  return withAuth(async (user) => {
    const ctx = await getBillingContext();
    const { today } = ctx;
    const tomorrow = addDays(today, 1);

    const [rooms, active, recentlyLeft, payments, activity, upcomingCount] = await Promise.all([
      prisma.room.findMany({ orderBy: { roomNumber: "asc" } }),
      prisma.booking.findMany({
        where: {
          OR: [{ status: "checked_in" }, { status: "reserved", checkInDate: { lte: dateFromKey(today) } }],
        },
        include: bookingInclude,
        orderBy: { checkInDate: "asc" },
      }),
      prisma.booking.findMany({
        where: { status: "checked_out", checkOutDate: { gte: dateFromKey(addDays(today, -60)) } },
        include: bookingInclude,
        orderBy: { checkOutDate: "desc" },
      }),
      prisma.payment.findMany({
        where: { status: "completed", paidAt: { gte: dateFromKey(addDays(today, -1)) } },
        include: { booking: { include: { guest: true, room: true } } },
        orderBy: { paidAt: "desc" },
      }),
      isAdmin(user) ? prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }) : Promise.resolve([]),
      prisma.booking.count({
        where: {
          status: "reserved",
          checkInDate: { gte: dateFromKey(tomorrow), lt: dateFromKey(addDays(today, 8)) },
        },
      }),
    ]);

    const serialized = active.map((b) => serializeBooking(b, ctx));
    const arrivals = serialized.filter((b) => b.status === "reserved");
    const inHouse = serialized.filter((b) => b.status === "checked_in");
    const departures = inHouse.filter((b) => b.checkOutDate <= today);

    // Rooms that are taken tonight by someone staying or arriving.
    const bookedTonight = await prisma.booking.findMany({
      where: {
        status: { in: ["reserved", "checked_in"] },
        checkInDate: { lte: dateFromKey(today) },
        checkOutDate: { gt: dateFromKey(today) },
      },
      select: { roomId: true },
    });
    const overstaying = inHouse.filter((b) => b.checkOutDate < today);
    const takenTonight = new Set([...bookedTonight.map((b) => b.roomId), ...overstaying.map((b) => b.roomId)]);
    const usable = rooms.filter((r) => r.status !== "maintenance");
    const freeTonight = usable.filter((r) => !takenTonight.has(r.id));

    const todaysPayments = payments.filter((p) => todayKey(ctx.settings.timezone, p.paidAt) === today);
    const collectedByMethod: Record<string, number> = {};
    let collected = 0;
    for (const p of todaysPayments) {
      const signed = p.type === "refund" ? -p.amount : p.amount;
      collected += signed;
      collectedByMethod[p.method] = round2((collectedByMethod[p.method] || 0) + signed);
    }

    const unpaid = [...serialized, ...recentlyLeft.map((b) => serializeBooking(b, ctx))]
      .filter((b) => b.folio.balance > 0.5 && b.status !== "reserved")
      .sort((a, b) => b.folio.balance - a.folio.balance);

    return NextResponse.json({
      today,
      hotelName: ctx.settings.hotelName,
      stats: {
        totalRooms: rooms.length,
        occupied: inHouse.length,
        freeTonight: freeTonight.length,
        dirty: rooms.filter((r) => r.housekeeping !== "clean").length,
        maintenance: rooms.filter((r) => r.status === "maintenance").length,
        occupancy: usable.length ? Math.round((takenTonight.size / usable.length) * 100) : 0,
        collectedToday: round2(collected),
        collectedByMethod,
        upcomingWeek: upcomingCount,
        owed: round2(unpaid.reduce((s, b) => s + b.folio.balance, 0)),
      },
      arrivals,
      departures,
      inHouse,
      unpaid: unpaid.slice(0, 20),
      rooms: rooms.map((r) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        type: r.type,
        status: r.status,
        housekeeping: r.housekeeping,
        houseKeeperName: r.houseKeeperName,
        freeTonight: r.status !== "maintenance" && !takenTonight.has(r.id),
        guestName: inHouse.find((b) => b.roomId === r.id)?.guestName ?? null,
        arrivingGuest: arrivals.find((b) => b.roomId === r.id && b.checkInDate === today)?.guestName ?? null,
      })),
      todaysPayments: todaysPayments.slice(0, 10),
      activity,
    });
  });
}
