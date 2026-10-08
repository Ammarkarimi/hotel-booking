import { z } from "zod";
import { rawPrisma } from "./db";
import { fail } from "./api";
import { todayKey } from "./dates";
import { PLATFORM_TIMEZONE, slugify } from "./platform";
import { RESERVED_SLUGS } from "./public";
import { addMonths, isMonth, monthOf, subscriptionSummary } from "./subscription";

export const SUBSCRIPTION_METHODS = ["upi", "bank_transfer", "cash", "card", "cheque", "other"] as const;

export function platformToday() {
  return todayKey(PLATFORM_TIMEZONE);
}

export function currentMonth() {
  return monthOf(platformToday());
}

const optionalText = z.string().trim().max(200).optional().nullable();
const month = z.string().refine(isMonth, "Choose a month");

export const hotelFields = {
  name: z.string().trim().min(2, "Hotel name is required").max(120),
  slug: z.string().trim().max(60).optional(),
  city: optionalText,
  contactName: optionalText,
  contactPhone: optionalText,
  contactEmail: z.string().trim().email("Email is not valid").optional().nullable().or(z.literal("")),
  monthlyFee: z.coerce.number().min(0, "Fee cannot be negative").max(10_000_000),
  billingStart: month,
  notes: z.string().trim().max(2000).optional().nullable(),
};

/** Checks a requested booking-page name, or finds a free one based on the hotel name. */
export async function chooseSlug(requested: string | undefined, hotelName: string, excludeHotelId?: string) {
  const taken = async (slug: string) => {
    const hotel = await rawPrisma.hotel.findUnique({ where: { slug } });
    return RESERVED_SLUGS.includes(slug) || (!!hotel && hotel.id !== excludeHotelId);
  };
  if (requested) {
    const slug = slugify(requested);
    if (await taken(slug)) fail(`The booking page name "${slug}" is already used. Please choose another.`);
    return slug;
  }
  const base = slugify(hotelName);
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await taken(slug))) return slug;
  }
  fail("Could not find a free booking page name. Please type one.");
}

export async function assertEmailFree(email: string) {
  // Sign-in emails are unique across every hotel.
  if (await rawPrisma.staff.findUnique({ where: { email } })) {
    fail("This email already signs in to a hotel. Please use a different email for the owner.");
  }
}

/** Every hotel with its usage and payment position, plus totals for the dashboard. */
export async function platformOverview() {
  const month = currentMonth();
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const nextMonthStart = new Date(`${addMonths(month, 1)}-01T00:00:00Z`);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [hotels, lastLogins, recentBookings, collected, recentPayments] = await Promise.all([
    rawPrisma.hotel.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscriptionPayments: { select: { month: true, amount: true, clearsMonth: true } },
        _count: { select: { rooms: true, staff: true } },
      },
    }),
    rawPrisma.staff.groupBy({ by: ["hotelId"], _max: { lastLoginAt: true } }),
    rawPrisma.booking.groupBy({ by: ["hotelId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    rawPrisma.subscriptionPayment.aggregate({
      where: { paidOn: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    rawPrisma.subscriptionPayment.findMany({
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { hotel: { select: { id: true, name: true } } },
    }),
  ]);

  const loginBy = new Map(lastLogins.map((l) => [l.hotelId, l._max.lastLoginAt]));
  const bookingsBy = new Map(recentBookings.map((b) => [b.hotelId, b._count._all]));

  const rows = hotels.map(({ subscriptionPayments, _count, ...hotel }) => {
    const s = subscriptionSummary(hotel, subscriptionPayments, month);
    return {
      ...hotel,
      rooms: _count.rooms,
      staff: _count.staff,
      lastLoginAt: loginBy.get(hotel.id) ?? null,
      bookings30d: bookingsBy.get(hotel.id) ?? 0,
      subscription: {
        currentStatus: s.currentStatus,
        overdueMonths: s.overdueMonths,
        outstanding: s.outstanding,
        paidUntil: s.paidUntil,
      },
    };
  });

  const active = rows.filter((h) => h.status === "active");
  return {
    month,
    hotels: rows,
    recentPayments,
    totals: {
      hotels: rows.length,
      active: active.length,
      suspended: rows.length - active.length,
      expectedMonthly: active.reduce((sum, h) => sum + h.monthlyFee, 0),
      collectedThisMonth: collected._sum.amount ?? 0,
      outstanding: rows.reduce((sum, h) => sum + h.subscription.outstanding, 0),
      unpaidThisMonth: rows.filter((h) => ["unpaid", "part_paid"].includes(h.subscription.currentStatus)).length,
      overdueHotels: rows.filter((h) => h.subscription.overdueMonths.length > 0).length,
    },
  };
}

/** One hotel in full: owner contacts, sign-in accounts, usage and every subscription payment. */
export async function platformHotelDetail(id: string) {
  const hotel = await rawPrisma.hotel.findUnique({
    where: { id },
    include: {
      subscriptionPayments: { orderBy: [{ month: "desc" }, { createdAt: "desc" }] },
      staff: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true },
      },
      _count: { select: { rooms: true, bookings: true, guests: true } },
    },
  });
  if (!hotel) fail("Hotel not found", 404);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const bookings30d = await rawPrisma.booking.count({ where: { hotelId: id, createdAt: { gte: since } } });
  const { subscriptionPayments, _count, ...rest } = hotel;
  return {
    ...rest,
    payments: subscriptionPayments,
    usage: { rooms: _count.rooms, bookings: _count.bookings, guests: _count.guests, bookings30d },
    subscription: subscriptionSummary(hotel, subscriptionPayments, currentMonth()),
    today: platformToday(),
  };
}

/** Removes a hotel and everything it ever stored. Cannot be undone. */
export async function deleteHotelData(hotelId: string) {
  await rawPrisma.$transaction(async (tx) => {
    const where = { hotelId };
    await tx.bill.deleteMany({ where });
    await tx.payment.deleteMany({ where });
    await tx.charge.deleteMany({ where });
    await tx.booking.deleteMany({ where });
    await tx.guestDocument.deleteMany({ where });
    await tx.guest.deleteMany({ where });
    await tx.room.deleteMany({ where });
    await tx.seasonalRate.deleteMany({ where });
    await tx.activityLog.deleteMany({ where });
    await tx.staff.deleteMany({ where });
    await tx.hotelSettings.deleteMany({ where });
    await tx.subscriptionPayment.deleteMany({ where });
    await tx.hotel.delete({ where: { id: hotelId } });
  });
}
