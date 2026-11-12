// Channex: turning the hotel's rooms, prices and bookings into what Channex wants, and Channex's
// bookings into ours. Pure: no database and no network here, so it can be tested.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { addDays, diffDays, isDateKey, toDateKey } from "./dates";
import { freeRoomsByType, siteFromName, siteName, splitGuestName, toRanges, type ChannelStayDates } from "./channels";
import { nightAdjustment, round2, type PricingRules } from "./pricing";
import { label } from "./utils";
import type { ChannelStay } from "./channel-bookings";
import type { ChannexRevision } from "./channex";

/** How many nights ahead free rooms and prices are sent. */
export const PUSH_DAYS = 365;

/** Our room type → its room type and rate plan in Channex (ChannexLink.roomMap). */
export interface RoomMapEntry {
  roomTypeId: string;
  /** Empty when making the rate plan failed half-way: it is made on the next try. */
  ratePlanId: string;
  /** The count_of_rooms Channex has, so a change can be sent. */
  rooms?: number;
}
export type RoomMap = Record<string, RoomMapEntry>;

export function parseRoomMap(raw: string | null | undefined): RoomMap {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: RoomMap = {};
    for (const [type, v] of Object.entries(parsed as Record<string, Partial<RoomMapEntry> | null>)) {
      if (!v || typeof v.roomTypeId !== "string" || !v.roomTypeId) continue;
      map[type] = { roomTypeId: v.roomTypeId, ratePlanId: typeof v.ratePlanId === "string" ? v.ratePlanId : "", ...(typeof v.rooms === "number" && { rooms: v.rooms }) };
    }
    return map;
  } catch {
    return {};
  }
}

export interface MapRoom {
  id: string;
  type: string;
  capacity: number;
  pricePerNight: number;
  status: string; // maintenance = not sold
}

/** One of the hotel's room types as Channex needs it. */
export interface RoomTypeSpec {
  type: string;
  title: string; // "Deluxe room"
  /** Rooms of the type that can be sold (not under repair). */
  rooms: number;
  /** What Channex is told: it needs at least 1 even when every room is under repair. */
  countOfRooms: number;
  occAdults: number;
  defaultOccupancy: number;
  /** The lowest price per night among the rooms that can be sold (all rooms when none can). */
  basePrice: number;
}

/** A Channex room type = all our rooms with the same type. Sorted by type, titles never the same twice. */
export function roomTypeSpecs(rooms: MapRoom[]): RoomTypeSpec[] {
  const byType = new Map<string, MapRoom[]>();
  for (const r of rooms) byType.set(r.type, [...(byType.get(r.type) ?? []), r]);
  const titles = new Set<string>();
  return [...byType.keys()].sort().map((type) => {
    const all = byType.get(type)!;
    const usable = all.filter((r) => r.status !== "maintenance");
    const occAdults = Math.max(1, ...all.map((r) => Math.floor(r.capacity) || 1));
    let title = `${label(type) || type} room`;
    if (titles.has(title.toLowerCase())) title = `${title} (${type})`;
    titles.add(title.toLowerCase());
    return {
      type,
      title,
      rooms: usable.length,
      countOfRooms: Math.max(1, usable.length),
      occAdults,
      defaultOccupancy: Math.min(2, occAdults),
      basePrice: Math.min(...(usable.length ? usable : all).map((r) => r.pricePerNight)),
    };
  });
}

// ---- What is created in Channex when the hotel connects ---------------------------------------

export interface PropertySettings {
  hotelName: string;
  currency: string;
  timezone: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
}

const clip = (value: string | null | undefined, max: number) => (value ?? "").trim().slice(0, max) || undefined;

export function propertyPayload(s: PropertySettings) {
  const email = clip(s.email, 255);
  return {
    title: clip(s.hotelName, 255) ?? "Hotel",
    currency: (s.currency || "INR").toUpperCase(),
    timezone: s.timezone || "Asia/Kolkata",
    property_type: "hotel",
    ...(email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && { email }),
    ...(clip(s.phone, 32) && { phone: clip(s.phone, 32) }),
    ...(clip(s.address, 255) && { address: clip(s.address, 255) }),
    ...(clip(s.city, 255) && { city: clip(s.city, 255) }),
    // The settings have no country; an Indian timezone is a hotel in India.
    ...((s.timezone === "Asia/Kolkata" || s.timezone === "Asia/Calcutta") && { country: "IN" }),
  };
}

export function roomTypePayload(propertyId: string, spec: RoomTypeSpec) {
  return {
    property_id: propertyId,
    title: spec.title,
    count_of_rooms: spec.countOfRooms,
    occ_adults: spec.occAdults,
    occ_children: 0,
    occ_infants: 0,
    default_occupancy: spec.defaultOccupancy,
    room_kind: "room",
  };
}

export function ratePlanPayload(propertyId: string, roomTypeId: string, spec: RoomTypeSpec, currency: string, markup: number) {
  return {
    title: "Standard rate",
    property_id: propertyId,
    room_type_id: roomTypeId,
    currency: (currency || "INR").toUpperCase(),
    sell_mode: "per_room",
    rate_mode: "manual",
    // The price for days we have not sent yet (more than a year ahead): the usual price, never 0.
    options: [{ occupancy: spec.occAdults, is_primary: true, rate: rateString(sellingRate(spec.basePrice, 0, markup, currency)) }],
  };
}

// ---- Free rooms and prices --------------------------------------------------------------------

/** The price sent to booking sites for one night: the room price, changed by the weekend and season rules, plus the markup. */
export function sellingRate(basePrice: number, adjustmentPercent: number, markupPercent: number, currency: string): number {
  const rate = Math.max(0, basePrice * (1 + adjustmentPercent / 100) * (1 + (markupPercent || 0) / 100));
  // Whole rupees: a price like ₹2,847.60 looks wrong on a booking site.
  return (currency || "INR").toUpperCase() === "INR" ? Math.round(rate + Number.EPSILON) : round2(rate);
}

/** Channex takes a decimal amount written as text ("2500.00"). */
export function rateString(rate: number): string {
  return rate.toFixed(2);
}

export interface StayRow {
  roomId: string;
  status: string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
}

/**
 * The nights each active booking holds its room. A guest still checked in after the planned
 * leaving date keeps the room until tomorrow (the same rule as src/lib/bookings.ts).
 */
export function stayDates(bookings: StayRow[], today: string): ChannelStayDates[] {
  return bookings
    .filter((b) => b.status === "reserved" || b.status === "checked_in")
    .map((b) => {
      const out = toDateKey(b.checkOutDate);
      return { roomId: b.roomId, checkIn: toDateKey(b.checkInDate), checkOut: b.status === "checked_in" && out < today ? addDays(today, 1) : out };
    });
}

export interface AvailabilityValue {
  property_id: string;
  room_type_id: string;
  date_from: string;
  date_to: string;
  availability: number;
}

export interface RestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date_from: string;
  date_to: string;
  rate: string;
}

export interface AriPayloads {
  availability: AvailabilityValue[];
  restrictions: RestrictionValue[];
  /** Tonight's price as sent, per room type. */
  tonight: Record<string, number>;
}

/**
 * Free rooms and prices for `days` nights from `today`, for every room type in the map, with equal
 * days joined into ranges. A type that has no rooms any more is sent as "no rooms free".
 */
export function buildAri(opts: {
  propertyId: string;
  roomMap: RoomMap;
  rooms: MapRoom[];
  stays: ChannelStayDates[];
  rules: PricingRules;
  markup: number;
  currency: string;
  today: string;
  days?: number;
}): AriPayloads {
  const days = opts.days ?? PUSH_DAYS;
  const free = freeRoomsByType(opts.rooms, opts.stays, opts.today, days);
  const specs = new Map(roomTypeSpecs(opts.rooms).map((s) => [s.type, s]));
  const availability: AvailabilityValue[] = [];
  const restrictions: RestrictionValue[] = [];
  const tonight: Record<string, number> = {};
  for (const type of Object.keys(opts.roomMap).sort()) {
    const { roomTypeId, ratePlanId } = opts.roomMap[type];
    const counts = (free[type] ?? new Array<number>(days).fill(0)).map((n) => Math.max(0, n));
    for (const r of toRanges(counts, opts.today)) {
      availability.push({ property_id: opts.propertyId, room_type_id: roomTypeId, date_from: r.from, date_to: r.to, availability: r.value });
    }
    const spec = specs.get(type);
    if (!spec || !ratePlanId) continue;
    const rates = Array.from({ length: days }, (_, i) => sellingRate(spec.basePrice, nightAdjustment(addDays(opts.today, i), type, opts.rules), opts.markup, opts.currency));
    tonight[type] = rates[0];
    for (const r of toRanges(rates, opts.today)) {
      // Channex refuses a price of 0, so a free night is simply not priced (and stays as it was).
      if (r.value > 0) restrictions.push({ property_id: opts.propertyId, rate_plan_id: ratePlanId, date_from: r.from, date_to: r.to, rate: rateString(r.value) });
    }
  }
  return { availability, restrictions, tonight };
}

/** A fingerprint of what would be sent: equal to the last one = nothing changed, nothing is sent. */
export function ariHash(ari: Pick<AriPayloads, "availability" | "restrictions">): string {
  return createHash("sha256").update(JSON.stringify([ari.availability, ari.restrictions])).digest("hex");
}

// ---- Bookings from the sites ------------------------------------------------------------------

export function channexRef(bookingId: string, roomIndex: number) {
  return `channex:${bookingId}:${roomIndex}`;
}

/** Every room of one Channex booking has a ref that starts with this. */
export function channexRefPrefix(bookingId: string) {
  return `channex:${bookingId}:`;
}

/** Rooms booked together on the site share this group; the same on every retry. */
export function channexGroupId(bookingId: string) {
  return `channex-${bookingId}`;
}

const NATIONALITIES: Record<string, string> = {
  IN: "Indian",
  US: "American",
  GB: "British",
  AU: "Australian",
  CA: "Canadian",
  DE: "German",
  FR: "French",
  IT: "Italian",
  ES: "Spanish",
  NL: "Dutch",
  RU: "Russian",
  CN: "Chinese",
  JP: "Japanese",
  KR: "South Korean",
  SG: "Singaporean",
  MY: "Malaysian",
  TH: "Thai",
  AE: "Emirati",
  NP: "Nepali",
  BD: "Bangladeshi",
  LK: "Sri Lankan",
  IL: "Israeli",
};

/**
 * The guest's nationality from the country a site gives ("NL" → "Dutch"). The country is where
 * the guest lives, which is nearly always right; null (= our default) when it is missing or unclear.
 */
export function nationalityFromCountry(country: string | null | undefined): string | null {
  const code = (country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (NATIONALITIES[code]) return NATIONALITIES[code];
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return name && name !== code ? name.slice(0, 40) : null;
  } catch {
    return null;
  }
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** A room of a site's booking that has no room type of ours: a person must put it in by hand. */
export interface UnmappedRoom {
  ref: string;
  title: string;
  details: string;
}

export interface MappedRevision {
  bookingId: string;
  status: "new" | "modified" | "cancelled";
  source: string;
  /** One per room that matches one of our room types. */
  stays: ChannelStay[];
  unmapped: UnmappedRoom[];
  /** The refs of every room still in the booking, matched or not. */
  refs: string[];
}

/**
 * One booking as a site sent it → the stays to write into our books, one per room.
 * `roomMap` says which of our room types each Channex room type is.
 */
export function mapRevision(rev: ChannexRevision, roomMap: RoomMap, hotelCurrency = "INR"): MappedRevision {
  // MakeMyTrip and Goibibo share one connection: the second name says where the guest really booked.
  const second = siteFromName(rev.secondary_ota);
  const source = second !== "other" ? second : siteFromName(rev.ota_name);
  const site = source === "other" && rev.ota_name ? rev.ota_name : siteName(source);
  const status = rev.status === "cancelled" ? "cancelled" : rev.status === "modified" ? "modified" : "new";
  const typeOf = new Map(Object.entries(roomMap).map(([type, m]) => [m.roomTypeId, type]));
  const c = rev.customer ?? {};
  const fullName = [c.name, c.surname].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
  const first = (c.name ?? "").replace(/\s+/g, " ").trim();
  const last = (c.surname ?? "").replace(/\s+/g, " ").trim();
  const name = first && last ? { firstName: first.slice(0, 80), lastName: last.slice(0, 80) } : splitGuestName(fullName, source);
  const phone = (c.phone ?? "").trim() || null;
  const sameCurrency = !rev.currency || rev.currency.toUpperCase() === (hotelCurrency || "INR").toUpperCase();
  const allRooms = rev.rooms ?? [];
  const live = allRooms.filter((r) => !r.is_cancelled);
  const paidOnSite = rev.payment_collect === "ota";
  const commission = num(rev.ota_commission);

  const stays: ChannelStay[] = [];
  const unmapped: UnmappedRoom[] = [];
  const refs: string[] = [];
  allRooms.forEach((room, index) => {
    if (room.is_cancelled) return;
    const ref = channexRef(rev.booking_id, index);
    const checkIn = isDateKey(room.checkin_date) ? room.checkin_date : rev.arrival_date;
    const checkOut = isDateKey(room.checkout_date) ? room.checkout_date : rev.departure_date;
    if (!isDateKey(checkIn) || !isDateKey(checkOut) || checkOut <= checkIn) return;
    refs.push(ref);
    const nights = Math.max(1, diffDays(checkIn, checkOut));
    const dayPrices = Object.values(room.days ?? {}).map(num).filter((n): n is number => n !== null);
    const amount = num(room.amount) ?? (dayPrices.length ? round2(dayPrices.reduce((a, b) => a + b, 0)) : live.length === 1 ? num(rev.amount) : null);
    const perNight = dayPrices.length ? round2(dayPrices.reduce((a, b) => a + b, 0) / dayPrices.length) : amount !== null ? round2(amount / nights) : null;
    const adults = Math.max(1, num(room.occupancy?.adults) ?? (live.length === 1 ? num(rev.occupancy?.adults) : null) ?? 1);
    const children = Math.max(0, (num(room.occupancy?.children) ?? 0) + (num(room.occupancy?.infants) ?? 0));
    const type = room.room_type_id ? typeOf.get(room.room_type_id) : undefined;
    const money = amount !== null ? `${rev.currency ?? hotelCurrency} ${amount.toFixed(2)}` : null;

    if (!type) {
      unmapped.push({
        ref,
        title: `${site} sold a room for ${checkIn} to ${checkOut} that is not matched to one of your room types`,
        details:
          [
            `Guest: ${[name.firstName, name.lastName].filter(Boolean).join(" ")}`,
            phone && `phone ${phone}`,
            c.mail && `email ${c.mail}`,
            `arriving ${checkIn}, leaving ${checkOut} (${nights} ${nights === 1 ? "night" : "nights"})`,
            `${adults} ${adults === 1 ? "adult" : "adults"}${children ? `, ${children} ${children === 1 ? "child" : "children"}` : ""}`,
            money && `price for the stay ${money}${paidOnSite ? `, already paid on ${site}` : ", to be paid at the hotel"}`,
            rev.ota_reservation_code && `${site} booking number ${rev.ota_reservation_code}`,
            live.length > 1 && `room ${live.indexOf(room) + 1} of ${live.length} in this booking`,
            rev.notes && `guest's note: ${rev.notes}`,
          ]
            .filter(Boolean)
            .join("; ") +
          `. This stay is NOT in your bookings: add it by hand in a free room. Then open Booking sites → Set up booking sites and match every room of ${site} to one of your room types, so the next booking comes in by itself.`,
      });
      return;
    }

    const notes = [
      (rev.notes ?? "").trim(),
      `Booked on ${site} through Channex`,
      live.length > 1 && `Room ${live.indexOf(room) + 1} of ${live.length} booked together`,
      rev.arrival_hour && `Arriving around ${rev.arrival_hour}`,
      !sameCurrency && money && `Price on ${site}: ${money} for the stay. The price below is your own room price: please check it.`,
      !paidOnSite && rev.payment_collect === "property" && "The guest pays at the hotel",
      commission !== null && commission > 0 && index === 0 && `${site} commission: ${rev.currency ?? hotelCurrency} ${commission.toFixed(2)}`,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1900);

    stays.push({
      ref,
      source,
      roomType: type,
      checkIn,
      checkOut,
      guest: {
        ...name,
        phone,
        email: (c.mail ?? "").trim() || null,
        address: (c.address ?? "").trim() || null,
        city: (c.city ?? "").trim() || null,
        state: (c.state ?? "").trim() || null,
        pinCode: (c.zip ?? "").trim() || null,
        nationality: nationalityFromCountry(c.country),
      },
      adults,
      children,
      ratePerNight: sameCurrency && perNight !== null && perNight > 0 ? perNight : null,
      otaReference: (rev.ota_reservation_code ?? "").trim() || null,
      notes,
      ...(paidOnSite && sameCurrency && amount !== null && amount > 0 && { prepaid: amount }),
      groupId: live.length > 1 ? channexGroupId(rev.booking_id) : null,
    });
  });
  return { bookingId: rev.booking_id, status, source, stays, unmapped, refs };
}

// ---- The webhook's secret ---------------------------------------------------------------------

export const WEBHOOK_HEADER = "x-innvela-webhook-secret";

/**
 * The value Channex must send back with every message for this property. Made from the property
 * id and our own secret, so a header that leaks at one hotel does not open the others.
 */
export function webhookSecret(propertyId: string, secret: string): string {
  return createHmac("sha256", secret).update(`channex-webhook:${propertyId}`).digest("hex");
}

/** Compares without giving away, by the time taken, how much of the value was right. */
export function sameSecret(given: string | null | undefined, expected: string): boolean {
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
