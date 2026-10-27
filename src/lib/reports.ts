import { prisma } from "./db";
import { addDays, dateFromKey, diffDays, eachNight, todayKey, toDateKey } from "./dates";
import { bookingInclude, folioFor, serializeBooking } from "./bookings";
import { groupKey, groupLabel, type GroupBy } from "./periods";
import { round2 } from "./pricing";
import type { BillingContext } from "./settings";

const SOLD_STATUSES = ["reserved", "checked_in", "checked_out"];

export interface MetricsInput {
  roomsAvailable: number; // room-nights the hotel could sell (rooms in use × nights)
  roomsSold: number; // room-nights with a guest
  roomRevenue: number; // before tax, after discounts
  extrasRevenue: number; // food, laundry and other items, before tax
  expenses: number;
}

/**
 * The standard hotel numbers, worked out the same way for a day, a week or a year.
 * Averages "per available room" divide by every room, sold or not: with 25 rooms
 * and 10 sold at ₹5,000, the average price (ADR) is ₹5,000 but the earnings per
 * available room (RevPAR) is ₹50,000 ÷ 25 = ₹2,000.
 */
export function hotelMetrics(m: MetricsInput) {
  const revenue = m.roomRevenue + m.extrasRevenue;
  const profit = revenue - m.expenses;
  const perAvailable = (n: number) => (m.roomsAvailable ? round2(n / m.roomsAvailable) : 0);
  const perSold = (n: number) => (m.roomsSold ? round2(n / m.roomsSold) : 0);
  return {
    occupancy: m.roomsAvailable ? Math.round((m.roomsSold / m.roomsAvailable) * 1000) / 10 : 0,
    adr: perSold(m.roomRevenue), // average price per room sold
    revpar: perAvailable(m.roomRevenue), // room earnings per available room
    trevpar: perAvailable(revenue), // all earnings per available room
    costPerAvailableRoom: perAvailable(m.expenses), // CPAR: what each room costs to run per night
    costPerOccupiedRoom: perSold(m.expenses), // CPOR: costs per room actually sold
    profitPerAvailableRoom: perAvailable(profit), // GOPPAR
    revenue: round2(revenue),
    profit: round2(profit),
    margin: revenue ? Math.round((profit / revenue) * 1000) / 10 : 0,
  };
}

interface DayRow {
  date: string;
  roomsSold: number;
  roomRevenue: number;
  extrasRevenue: number;
  expenses: number;
  collected: number;
  arrivals: number;
  departures: number;
}

export async function buildReport(ctx: BillingContext, from: string, to: string, groupBy: GroupBy = "day") {
  const endExclusive = addDays(to, 1);
  const dayCount = diffDays(from, endExclusive);
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));
  // Timestamps are widened by a day each side, then sorted into the hotel's local days.
  const widened = { gte: dateFromKey(addDays(from, -1)), lt: dateFromKey(addDays(endExclusive, 1)) };

  const [rooms, stays, cancelled, payments, charges, bills, expenses, made] = await Promise.all([
    prisma.room.findMany(),
    prisma.booking.findMany({
      where: {
        status: { in: SOLD_STATUSES },
        checkInDate: { lt: dateFromKey(endExclusive) },
        checkOutDate: { gte: dateFromKey(from) },
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
      where: { status: "completed", paidAt: widened },
      include: { booking: { include: { guest: true, room: true } } },
      orderBy: { paidAt: "asc" },
    }),
    prisma.charge.findMany({ where: { date: widened, booking: { status: { in: SOLD_STATUSES } } } }),
    prisma.bill.findMany({
      where: { generatedAt: widened },
      include: { booking: { include: { guest: true, room: true } } },
      orderBy: { generatedAt: "asc" },
    }),
    prisma.expense.findMany({
      where: { date: { gte: dateFromKey(from), lt: dateFromKey(endExclusive) } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.booking.findMany({ where: { createdAt: widened }, select: { createdAt: true, status: true } }),
  ]);

  const tz = ctx.settings.timezone;
  const localDay = (d: Date) => todayKey(tz, d);
  const inRange = (d: Date) => {
    const k = localDay(d);
    return k >= from && k <= to;
  };

  // Rooms under repair cannot be sold, so they do not count as available.
  const usable = rooms.filter((r) => r.status !== "maintenance");
  const sellable = usable.length ? usable : rooms;
  const usableRooms = sellable.length;
  const roomsByType: Record<string, number> = {};
  for (const r of sellable) roomsByType[r.type] = (roomsByType[r.type] || 0) + 1;

  const daily = new Map<string, DayRow>(
    days.map((d) => [d, { date: d, roomsSold: 0, roomRevenue: 0, extrasRevenue: 0, expenses: 0, collected: 0, arrivals: 0, departures: 0 }])
  );
  const bySource: Record<string, { bookings: number; nights: number; revenue: number }> = {};
  const byRoomType: Record<string, { nights: number; revenue: number }> = {};
  let arrivals = 0;
  let arrivalNights = 0;
  let guests = 0;

  for (const b of stays) {
    const checkIn = toDateKey(b.checkInDate);
    const checkOut = toDateKey(b.checkOutDate);
    const arrivalDay = daily.get(checkIn);
    if (arrivalDay) {
      arrivalDay.arrivals += 1;
      arrivals += 1;
      guests += b.adults + b.children;
      arrivalNights += eachNight(b.checkInDate, b.checkOutDate).length;
    }
    const departureDay = daily.get(checkOut);
    if (departureDay) departureDay.departures += 1;

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
    const day = daily.get(localDay(p.paidAt));
    if (day) day.collected += signed;
  }

  const extrasByCategory: Record<string, number> = {};
  for (const c of charges.filter((c) => inRange(c.date))) {
    extrasByCategory[c.category] = (extrasByCategory[c.category] || 0) + c.amount;
    const day = daily.get(localDay(c.date));
    if (day) day.extrasRevenue += c.amount;
  }

  const expensesByCategory: Record<string, number> = {};
  const expensesByMethod: Record<string, number> = {};
  for (const e of expenses) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
    expensesByMethod[e.method] = (expensesByMethod[e.method] || 0) + e.amount;
    const day = daily.get(toDateKey(e.date));
    if (day) day.expenses += e.amount;
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

  // Day rows, then the same numbers added up by day, week or month.
  const dayRows = [...daily.values()];
  const groupMap = new Map<string, DayRow & { days: number }>();
  for (const d of dayRows) {
    const key = groupKey(d.date, groupBy);
    const g = groupMap.get(key) ?? { ...d, date: key, days: 0, roomsSold: 0, roomRevenue: 0, extrasRevenue: 0, expenses: 0, collected: 0, arrivals: 0, departures: 0 };
    g.days += 1;
    g.roomsSold += d.roomsSold;
    g.roomRevenue += d.roomRevenue;
    g.extrasRevenue += d.extrasRevenue;
    g.expenses += d.expenses;
    g.collected += d.collected;
    g.arrivals += d.arrivals;
    g.departures += d.departures;
    groupMap.set(key, g);
  }
  const groups = [...groupMap.values()].map((g) => ({
    key: g.date,
    label: groupLabel(g.date, groupBy),
    // A week or month cut off by the chosen dates shows only the days inside them.
    from: g.date < from ? from : g.date,
    days: g.days,
    roomsAvailable: usableRooms * g.days,
    roomsSold: g.roomsSold,
    roomRevenue: round2(g.roomRevenue),
    extrasRevenue: round2(g.extrasRevenue),
    expenses: round2(g.expenses),
    collected: round2(g.collected),
    arrivals: g.arrivals,
    departures: g.departures,
    ...hotelMetrics({ roomsAvailable: usableRooms * g.days, roomsSold: g.roomsSold, roomRevenue: g.roomRevenue, extrasRevenue: g.extrasRevenue, expenses: g.expenses }),
  }));

  const roomNightsSold = dayRows.reduce((s, d) => s + d.roomsSold, 0);
  const roomRevenue = round2(dayRows.reduce((s, d) => s + d.roomRevenue, 0));
  const extrasRevenue = round2(dayRows.reduce((s, d) => s + d.extrasRevenue, 0));
  const expensesTotal = round2(expenses.reduce((s, e) => s + e.amount, 0));
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

  const cancelledCount = cancelled.filter((c) => c.status === "cancelled").length;
  const noShowCount = cancelled.filter((c) => c.status === "no_show").length;
  const madeInRange = made.filter((b) => inRange(b.createdAt));
  const cashIn = byMethod.cash || 0;
  const cashOut = expensesByMethod.cash || 0;

  return {
    from,
    to,
    days: dayCount,
    groupBy,
    rooms: usableRooms,
    totals: {
      availableRoomNights: available,
      roomNightsSold,
      roomRevenue,
      extrasRevenue,
      expenses: expensesTotal,
      ...hotelMetrics({ roomsAvailable: available, roomsSold: roomNightsSold, roomRevenue, extrasRevenue, expenses: expensesTotal }),
      collected: round2(collected),
      refunds: round2(refunds),
      moneyOut: expensesTotal,
      netCash: round2(collected - expensesTotal),
      cashInDrawer: round2(cashIn - cashOut),
      outstanding: round2(outstanding.reduce((s, o) => s + o.balance, 0)),
    },
    guests: {
      arrivals,
      departures: dayRows.reduce((s, d) => s + d.departures, 0),
      guests,
      averageStay: arrivals ? Math.round((arrivalNights / arrivals) * 10) / 10 : 0,
      bookingsMade: madeInRange.length,
      cancelled: cancelledCount,
      noShows: noShowCount,
      cancellationRate: arrivals + cancelledCount + noShowCount ? Math.round(((cancelledCount + noShowCount) / (arrivals + cancelledCount + noShowCount)) * 1000) / 10 : 0,
    },
    daily: dayRows.map((d) => ({ ...d, roomRevenue: round2(d.roomRevenue), extrasRevenue: round2(d.extrasRevenue), expenses: round2(d.expenses), collected: round2(d.collected) })),
    groups,
    bySource: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, { ...v, revenue: round2(v.revenue) }])),
    byRoomType: Object.entries(roomsByType)
      .map(([type, count]) => {
        const sold = byRoomType[type] ?? { nights: 0, revenue: 0 };
        const m = hotelMetrics({ roomsAvailable: count * dayCount, roomsSold: sold.nights, roomRevenue: sold.revenue, extrasRevenue: 0, expenses: 0 });
        return { type, rooms: count, nights: sold.nights, revenue: round2(sold.revenue), occupancy: m.occupancy, adr: m.adr, revpar: m.revpar };
      })
      .sort((a, b) => b.revenue - a.revenue),
    byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, round2(v)])),
    extrasByCategory: Object.fromEntries(Object.entries(extrasByCategory).map(([k, v]) => [k, round2(v)])),
    expensesByCategory: Object.fromEntries(Object.entries(expensesByCategory).map(([k, v]) => [k, round2(v)])),
    expensesByMethod: Object.fromEntries(Object.entries(expensesByMethod).map(([k, v]) => [k, round2(v)])),
    tax,
    invoices: invoices.map((b) => ({
      invoiceNumber: b.invoiceNumber,
      date: localDay(b.generatedAt),
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
    expenses: expenses.map((e) => ({ date: toDateKey(e.date), category: e.category, title: e.title, description: e.description, amount: e.amount, method: e.method, addedBy: e.addedBy })),
    outstanding,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
