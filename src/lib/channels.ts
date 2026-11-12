// Booking sites (the channel manager): what is shared by calendar links (iCal) and Channex.
// Pure: no database code here, so screens and tests can use it.
import { addDays, diffDays } from "./dates";

/** The booking sites a hotel can join. Each is also a booking source (src/lib/utils.ts). */
export const CHANNEL_SITES = ["booking_com", "makemytrip", "goibibo", "agoda", "airbnb", "expedia", "other"] as const;
export type ChannelSite = (typeof CHANNEL_SITES)[number];

export const CHANNEL_SITE_NAMES: Record<ChannelSite, string> = {
  booking_com: "Booking.com",
  makemytrip: "MakeMyTrip",
  goibibo: "Goibibo",
  agoda: "Agoda",
  airbnb: "Airbnb",
  expedia: "Expedia",
  other: "Booking site",
};

export function isChannelSite(value: unknown): value is ChannelSite {
  return typeof value === "string" && (CHANNEL_SITES as readonly string[]).includes(value);
}

export function siteName(site: string): string {
  return isChannelSite(site) ? CHANNEL_SITE_NAMES[site] : "Booking site";
}

/** The booking source for a site's name as a channel manager writes it ("Booking.com", "BookingCom", "MakeMyTrip"…). */
export function siteFromName(name: string | null | undefined): ChannelSite {
  const n = (name ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (n.includes("airbnb")) return "airbnb";
  if (n.includes("booking")) return "booking_com";
  if (n.includes("makemytrip") || n === "mmt") return "makemytrip";
  if (n.includes("goibibo")) return "goibibo";
  if (n.includes("agoda")) return "agoda";
  if (n.includes("expedia") || n.includes("hotelscom")) return "expedia";
  return "other";
}

export interface ChannelRoom {
  id: string;
  type: string;
  status: string; // maintenance rooms are never sold
}

export interface ChannelStayDates {
  roomId: string;
  checkIn: string; // date keys; the leaving day is free again
  checkOut: string;
}

/**
 * How many rooms of each type are free on each night, for `days` nights from `from`.
 * A room under repair is not counted. A night is the date of the evening the guest sleeps there.
 */
export function freeRoomsByType(rooms: ChannelRoom[], stays: ChannelStayDates[], from: string, days: number): Record<string, number[]> {
  const usable = rooms.filter((r) => r.status !== "maintenance");
  const typeOf = new Map(usable.map((r) => [r.id, r.type]));
  const free: Record<string, number[]> = {};
  for (const r of usable) {
    free[r.type] ??= new Array(days).fill(0);
    for (let i = 0; i < days; i++) free[r.type][i] += 1;
  }
  // One room can only be taken once a night, even if two stays overlap in it by mistake.
  const taken = new Set<string>();
  for (const s of stays) {
    const type = typeOf.get(s.roomId);
    if (!type) continue;
    const first = Math.max(0, diffDays(from, s.checkIn));
    const last = Math.min(days, diffDays(from, s.checkOut));
    for (let i = first; i < last; i++) {
      const key = `${s.roomId}|${i}`;
      if (taken.has(key)) continue;
      taken.add(key);
      free[type][i] -= 1;
    }
  }
  return free;
}

/** The nights (date keys) one room is taken, for `days` nights from `from`. */
export function busyNights(stays: Array<{ checkIn: string; checkOut: string }>, from: string, days: number): boolean[] {
  const busy = new Array(days).fill(false);
  for (const s of stays) {
    const first = Math.max(0, diffDays(from, s.checkIn));
    const last = Math.min(days, diffDays(from, s.checkOut));
    for (let i = first; i < last; i++) busy[i] = true;
  }
  return busy;
}

export interface ValueRange<T> {
  from: string; // first date, inclusive
  to: string; // last date, inclusive
  value: T;
}

/** Joins days that have the same value into date ranges, so a year fits in a few lines. */
export function toRanges<T>(values: T[], from: string, same: (a: T, b: T) => boolean = (a, b) => a === b): ValueRange<T>[] {
  const out: ValueRange<T>[] = [];
  values.forEach((value, i) => {
    const day = addDays(from, i);
    const last = out[out.length - 1];
    if (last && same(last.value, value)) last.to = day;
    else out.push({ from: day, to: day, value });
  });
  return out;
}

/** "Rahul Sharma" → first and last name; an empty name becomes the site's name ("Airbnb guest"). */
export function splitGuestName(full: string | null | undefined, site: string): { firstName: string; lastName: string } {
  const parts = (full ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!parts.length) return { firstName: siteName(site), lastName: "guest" };
  return { firstName: parts[0].slice(0, 80), lastName: parts.slice(1).join(" ").slice(0, 80) };
}
