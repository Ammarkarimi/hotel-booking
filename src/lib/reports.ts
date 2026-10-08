import { prisma } from "./db";
import { addDays, dateFromKey, diffDays, eachNight, todayKey, toDateKey } from "./dates";
import { bookingInclude, folioFor, serializeBooking } from "./bookings";
import { round2 } from "./pricing";
import type { BillingContext } from "./settings";

const SOLD_STATUSES = ["reserved", "checked_in", "checked_out"];

export async function buildReport(ctx: BillingContext, from: string, to: string) {
  const endExclusive = addDays(to, 1);
  const dayCount = diffDays(from, endExclusive);
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));

  const [rooms, stays, cancelled, payments, charges, bills] = await Promise.all([
    prisma.room.findMany(),
    prisma.booking.findMany({
      where: {
        status: { in: SOLD_STATUSES },
        checkInDate: { lt: dateFromKey(endExclusive) },
        checkOutDate: { gt: dateFromKey(from) },
      },
      include: bookingInclude,
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ["cancelled", "no_show"] },
        checkInDate: { gte: dateFromKey(from), lt: dateFromKey(endExclusive) },
      },
      select: { status: true },
    }),
    prisma.payment.findMany({
      where: { status: "completed", paidAt: { gte: dateFromKey(addDays(from, -1)), lt: dateFromKey(addDays(endExclusive, 1)) } },
      include: { booking: { include: { guest: true, room: true } } },
      orderBy: { paidAt: "asc" },
    }),
    prisma.charge.findMany({
      where: { date: { gte: dateFromKey(addDays(from, -1)), lt: dateFromKey(addDays(endExclusive, 1)) }, booking: { status: { in: SOLD_STATUSES } } },
    }),
    prisma.bill.findMany({
      where: { generatedAt: { gte: dateFromKey(addDays(from, -1)), lt: dateFromKey(addDays(endExclusive, 1)) } },
      include: { booking: { include: { guest: true, room: true } } },
      orderBy: { generatedAt: "asc" },
    }),
  ]);

  const tz = ctx.settings.timezone;
  const inRange = (d: Date) => {
    const k = todayKey(tz, d);
    return k >= from && k <= to;
  };

  const usableRooms = rooms.filter((r) => r.status !== "maintenance").length || rooms.length;
  const daily = new Map(days.map((d) => [d, { date: d, roomsSold: 0, roomRevenue: 0, collected: 0 }]));
  const bySource: Record<string, { bookings: number; nights: number; revenue: number }> = {};
  const byRoomType: Record<string, { nights: number; revenue: number }> = {};

  for (const b of stays) {
    const folio = folioFor(b, ctx);
    const nights = eachNight(b.checkInDate, b.checkOutDate);
    const perNight = nights.length ? folio.roomAfterDiscount / nights.length : 0;
    let nightsInRange = 0;
    for (const night of nights) {
      const day = daily.get(night);
      if (!day) continue;
      day.roomsSold += 1;
      day.roomRevenue += perNight;
      nightsInRange += 1;
    }
    if (nightsInRange === 0) continue;
    const src = (bySource[b.source] ??= { bookings: 0, nights: 0, revenue: 0 });
    src.bookings += 1;
    src.nights += nightsInRange;
    src.revenue += perNight * nightsInRange;
    const rt = (byRoomType[b.room.type] ??= { nights: 0, revenue: 0 });
    rt.nights += nightsInRange;
    rt.revenue += perNight * nightsInRange;
  }

  const byMethod: Record<string, number> = {};
  let collected = 0;
  let refunds = 0;
  const paymentsInRange = payments.filter((p) => inRange(p.paidAt));
  for (const p of paymentsInRange) {
    const signed = p.type === "refund" ? -p.amount : p.amount;
    if (p.type === "refund") refunds += p.amount;
    collected += signed;
    byMethod[p.method] = (byMethod[p.method] || 0) + signed;
    const day = daily.get(todayKey(tz, p.paidAt));
    if (day) day.collected += signed;
  }

  const extrasByCategory: Record<string, number> = {};
  for (const c of charges.filter((c) => inRange(c.date))) {
    extrasByCategory[c.category] = (extrasByCategory[c.category] || 0) + c.amount;
  }

  const invoices = bills.filter((b) => inRange(b.generatedAt));
  const tax = {
    invoices: invoices.length,
    taxable: round2(invoices.reduce((s, b) => s + b.roomCharges - b.discount + b.additionalCharges, 0)),
    roomTax: round2(invoices.reduce((s, b) => s + b.roomTax, 0)),
    extrasTax: round2(invoices.reduce((s, b) => s + b.extrasTax, 0)),
    total: round2(invoices.reduce((s, b) => s + b.taxAmount, 0)),
    invoiced: round2(invoices.reduce((s, b) => s + b.totalAmount, 0)),
  };

  const series = [...daily.values()].map((d) => ({
    ...d,
    roomRevenue: round2(d.roomRevenue),
    collected: round2(d.collected),
    occupancy: usableRooms ? Math.round((d.roomsSold / usableRooms) * 1000) / 10 : 0,
  }));
  const roomNightsSold = series.reduce((s, d) => s + d.roomsSold, 0);
  const roomRevenue = round2(series.reduce((s, d) => s + d.roomRevenue, 0));
  const available = usableRooms * dayCount;

  // Money still owed on stays that have started.
  const owedBookings = await prisma.booking.findMany({
    where: { status: { in: ["checked_in", "checked_out"] } },
    include: bookingInclude,
    orderBy: { checkOutDate: "desc" },
    take: 1000,
  });
  const outstanding = owedBookings
    .map((b) => serializeBooking(b, ctx))
    .filter((b) => b.folio.balance > 0.5)
    .map((b) => ({ id: b.id, number: b.number, guestName: b.guestName, phone: b.guest.phone, room: b.room.roomNumber, checkOut: b.checkOutDate, balance: b.folio.balance, status: b.status }));

  return {
    from,
    to,
    days: dayCount,
    totals: {
      occupancy: available ? Math.round((roomNightsSold / available) * 1000) / 10 : 0,
      roomNightsSold,
      availableRoomNights: available,
      roomRevenue,
      adr: roomNightsSold ? round2(roomRevenue / roomNightsSold) : 0,
      revpar: available ? round2(roomRevenue / available) : 0,
      extrasRevenue: round2(Object.values(extrasByCategory).reduce((s, v) => s + v, 0)),
      collected: round2(collected),
      refunds: round2(refunds),
      bookings: stays.filter((b) => toDateKey(b.checkInDate) >= from && toDateKey(b.checkInDate) <= to).length,
      cancelled: cancelled.filter((c) => c.status === "cancelled").length,
      noShows: cancelled.filter((c) => c.status === "no_show").length,
      outstanding: round2(outstanding.reduce((s, o) => s + o.balance, 0)),
    },
    series,
    bySource: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, { ...v, revenue: round2(v.revenue) }])),
    byRoomType: Object.fromEntries(Object.entries(byRoomType).map(([k, v]) => [k, { ...v, revenue: round2(v.revenue) }])),
    byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, round2(v)])),
    extrasByCategory: Object.fromEntries(Object.entries(extrasByCategory).map(([k, v]) => [k, round2(v)])),
    tax,
    invoices: invoices.map((b) => ({
      invoiceNumber: b.invoiceNumber,
      date: todayKey(tz, b.generatedAt),
      guestName: `${b.booking.guest.firstName} ${b.booking.guest.lastName}`.trim(),
      guestGstin: b.booking.guest.gstin,
      room: b.booking.room.roomNumber,
      taxable: round2(b.roomCharges - b.discount + b.additionalCharges),
      tax: b.taxAmount,
      total: b.totalAmount,
      bookingId: b.bookingId,
    })),
    payments: paymentsInRange.map((p) => ({
      id: p.id,
      paidAt: p.paidAt,
      amount: p.amount,
      method: p.method,
      type: p.type,
      reference: p.reference,
      receivedBy: p.receivedBy,
      bookingId: p.bookingId,
      bookingNumber: p.booking.number,
      guestName: `${p.booking.guest.firstName} ${p.booking.guest.lastName}`.trim(),
      room: p.booking.room.roomNumber,
    })),
    outstanding,
  };
}
