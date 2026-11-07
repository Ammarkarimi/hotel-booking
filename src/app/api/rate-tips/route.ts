import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, isAdmin, withModule } from "@/lib/api";
import { getPricingRules, getSettings } from "@/lib/settings";
import { addDays, dateFromKey, toDateKey } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { HISTORY_DAYS, SEEN_TEXT, isSeenText, localClock, parseFloors, salesInsights, tonightByType, type TipBooking } from "@/lib/rate-tips";

/** Rooms and bookings from `from` on (and every stay that covers `today`), as the tip maths needs them. */
async function load(from: string, today: string) {
  const rooms = await prisma.room.findMany({ select: { type: true, pricePerNight: true, status: true } });
  const bookings = await prisma.booking.findMany({
    where: { OR: [{ checkInDate: { gte: dateFromKey(from), lte: dateFromKey(today) } }, { checkInDate: { lte: dateFromKey(today) }, checkOutDate: { gt: dateFromKey(today) } }] },
    select: { checkInDate: true, checkOutDate: true, createdAt: true, status: true, ratePerNight: true, room: { select: { type: true } } },
  });
  const list: TipBooking[] = bookings.map((b) => ({
    roomType: b.room.type,
    checkIn: toDateKey(b.checkInDate),
    checkOut: toDateKey(b.checkOutDate),
    createdAt: b.createdAt,
    status: b.status,
    ratePerNight: b.ratePerNight,
  }));
  return { rooms, bookings: list };
}

/**
 * Tonight's rooms by type and the rate tips for them, which of the tips this person has not yet
 * confirmed seeing, and (for the owner) who has seen today's tips. `?insights=30` adds the last
 * 30 nights: how full each room type was and when bookings came in.
 */
export async function GET(request: NextRequest) {
  return withModule("rate_tips", async (user) => {
    const s = await getSettings();
    const admin = isAdmin(user);
    const visible = s.rateTips && (admin || s.rateTipsStaff);
    const now = new Date();
    const today = localClock(now, s.timezone).date;
    const { rooms, bookings } = await load(addDays(today, -HISTORY_DAYS), today);
    const tonight = tonightByType({
      now,
      timeZone: s.timezone,
      rooms,
      bookings,
      rules: await getPricingRules(s),
      settings: { from: s.rateTipsFrom, maxDiscount: s.rateTipsMaxDiscount, floors: parseFloors(s.rateTipsFloors) },
    });
    const tips = visible ? tonight.types.flatMap((t) => (t.tip ? [t.tip] : [])) : [];
    const mine = tips.length ? await prisma.rateTipSeen.findMany({ where: { staffId: user.id, tipKey: { in: tips.map((t) => t.key) } }, select: { tipKey: true } }) : [];
    const seen = new Set(mine.map((m) => m.tipKey));
    const seenBy = admin
      ? await prisma.rateTipSeen.findMany({ where: { tipKey: { startsWith: `${today}|` } }, orderBy: { createdAt: "asc" }, select: { tipKey: true, staffName: true, createdAt: true } })
      : [];

    const days = Number(request.nextUrl.searchParams.get("insights"));
    const insights =
      admin && days > 0 ? salesInsights({ today, days: Math.min(Math.round(days), HISTORY_DAYS), timeZone: s.timezone, rooms, bookings }) : undefined;

    return NextResponse.json({
      enabled: s.rateTips,
      visible,
      from: s.rateTipsFrom,
      date: tonight.date,
      started: tonight.started,
      types: visible || admin ? tonight.types.map((t) => (s.rateTips ? t : { ...t, tip: null })) : [],
      unseen: tips.filter((t) => !seen.has(t.key)),
      seenBy,
      ...(insights && { insights }),
    });
  });
}

const seenSchema = z.object({
  keys: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}\|[a-z_]+\|\d+$/)).min(1).max(20),
  text: z.string().max(40),
});

/** The person typed "I have seen": the tips they were shown stop popping up for them. */
export async function POST(request: NextRequest) {
  return withModule("rate_tips", async (user) => {
    const { keys, text } = seenSchema.parse(await request.json());
    if (!isSeenText(text)) fail(`Please type "${SEEN_TEXT}" to close the rate tips.`);
    await prisma.rateTipSeen.createMany({
      data: keys.map((tipKey) => ({ hotelId: currentHotelId(), staffId: user.id, staffName: user.name, tipKey })),
      skipDuplicates: true,
    });
    await logActivity(user, "Rate tips seen", keys.map((k) => k.split("|").slice(1).join(" at ₹")).join(", "));
    return NextResponse.json({ ok: true });
  });
}
