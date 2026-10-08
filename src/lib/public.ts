import { NextResponse } from "next/server";
import { prisma } from "./db";
import { fail } from "./api";
import { diffDays } from "./dates";
import type { BillingContext, HotelSettingsRecord } from "./settings";
import { parseAmenities } from "./utils";

export function publicHotel(s: HotelSettingsRecord) {
  return {
    hotelName: s.hotelName,
    tagline: s.tagline,
    address: s.address,
    city: s.city,
    phone: s.phone,
    email: s.email,
    currency: s.currency,
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
    bookingTerms: s.bookingTerms,
    websiteAbout: s.websiteAbout,
    websiteEnabled: s.websiteEnabled,
  };
}

export function assertWebsiteOpen(s: HotelSettingsRecord) {
  if (!s.websiteEnabled) fail("Online booking is currently closed. Please call the hotel.", 403);
}

export function validatePublicStay(ctx: BillingContext, checkIn: string, checkOut: string) {
  if (checkIn < ctx.today) fail("The arrival date cannot be in the past");
  if (diffDays(ctx.today, checkIn) > 365) fail("Bookings can be made up to one year ahead");
  if (diffDays(checkIn, checkOut) > 30) fail("For stays longer than 30 nights please contact the hotel");
}

export async function roomTypeSummaries() {
  const rooms = await prisma.room.findMany({ where: { status: { not: "maintenance" } }, orderBy: { pricePerNight: "asc" } });
  const types = new Map<string, { type: string; fromPrice: number; capacity: number; amenities: Set<string>; description: string | null; rooms: number }>();
  for (const r of rooms) {
    const t = types.get(r.type) ?? { type: r.type, fromPrice: r.pricePerNight, capacity: r.capacity, amenities: new Set<string>(), description: null, rooms: 0 };
    t.fromPrice = Math.min(t.fromPrice, r.pricePerNight);
    t.capacity = Math.max(t.capacity, r.capacity);
    t.description ??= r.description;
    t.rooms += 1;
    parseAmenities(r.amenities).forEach((a) => t.amenities.add(a));
    types.set(r.type, t);
  }
  return [...types.values()].map((t) => ({ ...t, amenities: [...t.amenities] }));
}

export function noStore(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store" } });
}

