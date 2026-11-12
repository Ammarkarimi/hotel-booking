// Calendar links (iCal) with booking sites: the calendar we give each site to read (the nights
// we already sold), and reading each site's own calendar and writing its stays into our books.
// The pure parts (reading and writing the calendar text, the echo rule) are in src/lib/ical.ts.
import { lookup } from "node:dns/promises";
import { prisma, rawPrisma, runForHotel } from "./db";
import { addDays, dateFromKey, diffDays, toDateKey } from "./dates";
import { ACTIVE_STATUSES } from "./bookings";
import { busyNights, freeRoomsByType, siteName, splitGuestName, toRanges } from "./channels";
import { cancelChannelStay, raiseChannelIssue, saveChannelStay, type ChannelStay } from "./channel-bookings";
import { getBillingContext, getHotelModules, type BillingContext } from "./settings";
import { OWN_UID_SUFFIX, blockStays, buildIcal, checkFeedUrl, classifyEvent, isPrivateAddress, parseIcal, type IcalEvent, type IcalOutEvent, type KnownStay } from "./ical";
import { label } from "./utils";

export interface CalendarSyncResult {
  /** Calendar links read. */
  read: number;
  created: number;
  updated: number;
  cancelled: number;
  issues: number;
  /** Links that could not be read. */
  errors: number;
}

/** A site's link is read again after this long. */
export const READ_EVERY_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2 * 1024 * 1024;
/** How far ahead our own calendar goes, and how far ahead a site's stays are taken. */
const EXPORT_DAYS = 365;
const IMPORT_DAYS = 730;

/** One calendar link, as the Booking sites screen shows it. */
export interface CalendarLinkDTO {
  id: string;
  source: string;
  siteName: string;
  name: string | null;
  roomId: string | null;
  roomNumber: string | null;
  roomType: string | null;
  /** Our link for the site to read: add it to the address of this website. */
  exportPath: string;
  /** The site's link that we read; null = we only send. */
  importUrl: string | null;
  active: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  lastEvents: number;
  /** When the site last read our link. */
  exportSeenAt: string | null;
  /** Bookings from this link that are still to come or staying now. */
  upcoming: number;
}

export interface CalendarLinksDTO {
  calendars: CalendarLinkDTO[];
  rooms: Array<{ id: string; roomNumber: string; type: string }>;
  roomTypes: string[];
}

export function calendarExportPath(token: string) {
  return `/api/public/ical/${token}.ics`;
}

function allowLocal() {
  return process.env.CHANNEL_ALLOW_LOCAL === "1";
}

/** Checks a site's calendar link before it is saved. */
export function checkImportUrl(raw: string) {
  const checked = checkFeedUrl(raw, allowLocal());
  if (checked.ok && /\/api\/public\/ical\//.test(checked.url)) {
    return { ok: false as const, message: "This is our own link. Paste the link that the booking site gives you for its calendar." };
  }
  return checked;
}

export async function listCalendarLinks(ctx: BillingContext): Promise<CalendarLinksDTO> {
  const [calendars, rooms, counts] = await Promise.all([
    prisma.channelCalendar.findMany({ include: { room: { select: { roomNumber: true, type: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.room.findMany({ select: { id: true, roomNumber: true, type: true }, orderBy: { roomNumber: "asc" } }),
    prisma.booking.groupBy({
      by: ["channelCalendarId"],
      where: { channelCalendarId: { not: null }, status: { in: ACTIVE_STATUSES }, checkOutDate: { gt: dateFromKey(ctx.today) } },
      _count: { _all: true },
    }),
  ]);
  const upcoming = new Map(counts.map((c) => [c.channelCalendarId, c._count._all]));
  return {
    calendars: calendars.map((c) => ({
      id: c.id,
      source: c.source,
      siteName: siteName(c.source),
      name: c.name,
      roomId: c.roomId,
      roomNumber: c.room?.roomNumber ?? null,
      roomType: c.roomType ?? c.room?.type ?? null,
      exportPath: calendarExportPath(c.exportToken),
      importUrl: c.importUrl,
      active: c.active,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      lastError: c.lastError,
      lastEvents: c.lastEvents,
      exportSeenAt: c.exportSeenAt?.toISOString() ?? null,
      upcoming: upcoming.get(c.id) ?? 0,
    })),
    rooms,
    roomTypes: [...new Set(rooms.map((r) => r.type))],
  };
}

// ───────────────────────── What is taken ─────────────────────────

interface Stay {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  channelRef: string | null;
  channelCalendarId: string | null;
}

/**
 * Every booking that holds a room on or after `from`. A guest who is still checked in after the
 * planned leaving date keeps the room until tomorrow (the same rule as findConflicts in bookings.ts).
 */
async function activeStays(from: string, today: string): Promise<Stay[]> {
  const rows = await prisma.booking.findMany({
    where: { status: { in: ACTIVE_STATUSES }, OR: [{ checkOutDate: { gt: dateFromKey(from) } }, { status: "checked_in" }] },
    select: { id: true, roomId: true, checkInDate: true, checkOutDate: true, status: true, channelRef: true, channelCalendarId: true },
  });
  return rows
    .map((b) => {
      const out = toDateKey(b.checkOutDate);
      return {
        id: b.id,
        roomId: b.roomId,
        checkIn: toDateKey(b.checkInDate),
        checkOut: b.status === "checked_in" && out < today ? addDays(today, 1) : out,
        channelRef: b.channelRef,
        channelCalendarId: b.channelCalendarId,
      };
    })
    .filter((s) => s.checkOut > from);
}

type CalendarRow = { id: string; source: string; roomId: string | null; roomType: string | null };
type RoomRow = { id: string; type: string; status: string; roomNumber: string };

/**
 * The nights this calendar's room (or every room of its type) is taken, for `days` nights from
 * `from`, NOT counting the bookings this same calendar brought. This is exactly what we tell the
 * site, and so also exactly what the site sends back to us as "not available".
 */
function takenNights(calendar: CalendarRow, rooms: RoomRow[], stays: Stay[], from: string, days: number): boolean[] {
  const others = stays.filter((s) => s.channelCalendarId !== calendar.id);
  if (calendar.roomId) {
    const room = rooms.find((r) => r.id === calendar.roomId);
    if (!room || room.status === "maintenance") return new Array(days).fill(true);
    return busyNights(
      others.filter((s) => s.roomId === room.id),
      from,
      days
    );
  }
  const ofType = rooms.filter((r) => r.type === calendar.roomType);
  const free = freeRoomsByType(ofType, others, from, days)[calendar.roomType ?? ""];
  return free ? free.map((n) => n <= 0) : new Array(days).fill(true);
}

// ───────────────────────── Our calendar, for the site to read ─────────────────────────

/** The calendar text for one link: the nights we already sold, without any guest details. */
export async function buildCalendarFeed(calendar: CalendarRow, ctx: BillingContext): Promise<string> {
  const from = addDays(ctx.today, -1);
  const days = EXPORT_DAYS + 2; // yesterday, today and 365 more nights
  const until = addDays(from, days);
  const [rooms, stays] = await Promise.all([prisma.room.findMany({ select: { id: true, type: true, status: true, roomNumber: true } }), activeStays(from, ctx.today)]);
  const room = calendar.roomId ? rooms.find((r) => r.id === calendar.roomId) : null;
  const events: IcalOutEvent[] = [];
  if (room && room.status !== "maintenance") {
    // One room: each booking is its own event, so the site sees every change clearly.
    for (const s of stays) {
      if (s.roomId !== room.id || s.channelCalendarId === calendar.id || s.checkIn >= until) continue;
      events.push({ uid: `booking-${s.id}${OWN_UID_SUFFIX}`, start: s.checkIn, end: s.checkOut, summary: "Booked" });
    }
    events.sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid));
  } else {
    // A room type is only closed on the nights when none of its rooms is free; a room under repair for the whole time.
    const taken = takenNights(calendar, rooms, stays, from, days);
    for (const range of toRanges(taken, from)) {
      if (!range.value) continue;
      events.push({ uid: `closed-${calendar.id}-${range.from}${OWN_UID_SUFFIX}`, start: range.from, end: addDays(range.to, 1), summary: "Not available" });
    }
  }
  const what = room ? `Room ${room.roomNumber}` : calendar.roomType ? `${label(calendar.roomType)} rooms` : "Rooms";
  return buildIcal({ name: `${ctx.settings.hotelName} - ${what}`, events });
}

/**
 * The calendar behind a secret link, or null when the link is not known, is paused, or its hotel
 * is closed. Notes that the site read it. `stale` = this hotel has site calendars waiting to be read.
 */
export async function calendarFeedByToken(token: string): Promise<{ hotelId: string; body: string; stale: boolean } | null> {
  if (!/^[a-f0-9]{16,128}$/i.test(token)) return null;
  const found = await rawPrisma.channelCalendar.findUnique({ where: { exportToken: token }, include: { hotel: { select: { status: true } } } });
  if (!found || !found.active || found.hotel.status !== "active") return null;
  return runForHotel(found.hotelId, async () => {
    if (!(await getHotelModules()).includes("channel_manager")) return null;
    const ctx = await getBillingContext();
    const body = await buildCalendarFeed(found, ctx);
    await prisma.channelCalendar.update({ where: { id: found.id }, data: { exportSeenAt: new Date() } });
    const waiting = await prisma.channelCalendar.count({
      where: { active: true, importUrl: { not: null }, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - READ_EVERY_MS) } }] },
    });
    return { hotelId: found.hotelId, body, stale: waiting > 0 };
  });
}

// ───────────────────────── Reading a site's calendar ─────────────────────────

type Fetched = { ok: true; text: string } | { ok: false; message: string };

/** Downloads a calendar link: 15 seconds at most, 2 MB at most, never from inside our own network. */
export async function fetchCalendar(rawUrl: string): Promise<Fetched> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let url = rawUrl;
  try {
    for (let hop = 0; hop < 6; hop++) {
      const checked = checkFeedUrl(url, allowLocal());
      if (!checked.ok) return { ok: false, message: checked.message };
      url = checked.url;
      if (!allowLocal()) {
        // The name must not lead to an address inside a private network either.
        const addresses = await lookup(new URL(url).hostname, { all: true }).catch(() => []);
        if (addresses.some((a) => isPrivateAddress(a.address))) return { ok: false, message: "This link points inside a private network and cannot be read." };
      }
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { "User-Agent": "Innvela calendar sync", Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url).toString();
        await res.body?.cancel().catch(() => {});
        continue;
      }
      if (res.status !== 200) {
        await res.body?.cancel().catch(() => {});
        const why = res.status === 404 || res.status === 410 ? "The link no longer exists" : res.status === 401 || res.status === 403 ? "The site refused the link" : `The site answered with an error (${res.status})`;
        return { ok: false, message: `${why}. Copy the calendar link from the booking site again and paste it here.` };
      }
      if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return { ok: false, message: "The site's calendar is too big to read." };
      const reader = res.body?.getReader();
      if (!reader) return { ok: true, text: await res.text() };
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel().catch(() => {});
          return { ok: false, message: "The site's calendar is too big to read." };
        }
        chunks.push(value);
      }
      return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
    }
    return { ok: false, message: "The link sends us from one address to another without end." };
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "TimeoutError" || name === "AbortError") return { ok: false, message: "The site did not answer in 15 seconds. It will be tried again in a few minutes." };
    return { ok: false, message: "The site could not be reached. It will be tried again in a few minutes." };
  }
}

/** Why a booking was cancelled when its stay is no longer in the site's calendar. A stay that comes back is booked again. */
function goneReason(source: string) {
  return `No longer in ${siteName(source)}'s calendar`;
}

function blockNote(source: string) {
  const site = siteName(source);
  return (
    `${site}'s calendar shows these nights as taken, but does not give the guest's name: look in ${site} for the booking. ` +
    `If you have just cancelled or moved a booking of your own for these nights, ${site} may only be repeating it; this booking then goes away by itself in a few hours.`
  );
}

/**
 * A link that was removed and added again has a new id, so the stays it brought before would be
 * booked a second time. Bookings of the same site with the same event ID, whose link is gone, are
 * handed to this link instead.
 */
async function adoptOrphans(calendar: CalendarRow & { room: { type: string } | null }, uids: Set<string>) {
  const live = (await prisma.channelCalendar.findMany({ select: { id: true } })).map((c) => c.id);
  const orphans = await prisma.booking.findMany({
    where: { status: { in: ACTIVE_STATUSES }, source: calendar.source, channelRef: { startsWith: "ical:" }, OR: [{ channelCalendarId: null }, { channelCalendarId: { notIn: live } }] },
    select: { id: true, channelRef: true, room: { select: { type: true } } },
  });
  const type = calendar.roomType ?? calendar.room?.type;
  for (const b of orphans) {
    const rest = /^ical:[^:]+:(.+)$/.exec(b.channelRef ?? "")?.[1];
    if (!rest || b.room.type !== type) continue;
    const night = /^(.+):\d{4}-\d{2}-\d{2}$/.exec(rest)?.[1];
    if (!uids.has(rest) && !(night && uids.has(night))) continue;
    const ref = `ical:${calendar.id}:${rest}`;
    if (await prisma.booking.findFirst({ where: { channelRef: ref }, select: { id: true } })) continue;
    await prisma.booking.update({ where: { id: b.id }, data: { channelRef: ref, channelCalendarId: calendar.id } });
  }
}

type CalendarWithRoom = CalendarRow & { importUrl: string | null; lastError: string | null; room: { type: string; roomNumber: string } | null };

/** What one site's calendar asks of our books: the stays to write. Reads the database, changes nothing. */
async function planStays(calendar: CalendarWithRoom, events: IcalEvent[], ctx: BillingContext): Promise<ChannelStay[]> {
  const today = ctx.today;
  const base = { source: calendar.source, calendarId: calendar.id, roomId: calendar.roomId, roomType: calendar.roomType ?? calendar.room?.type ?? null };
  const stays: ChannelStay[] = [];
  const blocks: IcalEvent[] = [];
  const sold = new Set<string>(); // nights the site's own reservations take

  for (const event of events) {
    const what = classifyEvent(event, calendar.source);
    if (what.kind === "block") {
      blocks.push(event);
      continue;
    }
    stays.push({ ...base, ref: `ical:${calendar.id}:${event.uid}`, checkIn: event.start, checkOut: event.end, guest: what.guest, otaReference: what.otaReference, notes: what.notes });
    for (let night = event.start < today ? today : event.start; night < event.end; night = addDays(night, 1)) sold.add(night);
  }
  if (!blocks.length) return stays;

  // The echo rule (src/lib/ical.ts): a "not available" is only written for the nights that are not ours already.
  const last = blocks.reduce((max, e) => (e.end > max ? e.end : max), today);
  const days = Math.min(diffDays(today, last), IMPORT_DAYS + 400);
  const [rooms, active] = await Promise.all([prisma.room.findMany({ select: { id: true, type: true, status: true, roomNumber: true } }), activeStays(today, today)]);
  const ours = takenNights(calendar, rooms, active, today, days);
  const written = new Set<string>();
  const taken = (night: string) => {
    const i = diffDays(today, night);
    return i < 0 || i >= days || ours[i] || sold.has(night) || written.has(night);
  };
  const known: KnownStay[] = active.filter((s) => s.channelCalendarId === calendar.id && s.channelRef).map((s) => ({ ref: s.channelRef!, checkIn: s.checkIn, checkOut: s.checkOut }));
  const guest = splitGuestName(null, calendar.source);
  blocks.sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid));
  for (const event of blocks) {
    for (const run of blockStays({ event, refBase: `ical:${calendar.id}:${event.uid}`, today, taken, known })) {
      stays.push({ ...base, ref: run.ref, checkIn: run.checkIn, checkOut: run.checkOut, guest, notes: blockNote(calendar.source) });
      for (let night = run.checkIn < today ? today : run.checkIn; night < run.checkOut; night = addDays(night, 1)) written.add(night);
    }
  }
  return stays;
}

type Counts = Omit<CalendarSyncResult, "read" | "errors">;

/** Reads one site's calendar and brings our bookings in step with it. Returns null (and changes no booking) when it cannot be read. */
async function readCalendar(calendar: CalendarWithRoom, ctx: BillingContext): Promise<{ counts: Counts; events: number; problem: string | null } | { failed: string }> {
  const startedAt = new Date();
  const fetched = await fetchCalendar(calendar.importUrl!);
  if (!fetched.ok) return { failed: fetched.message };
  const parsed = parseIcal(fetched.text, { timeZone: ctx.settings.timezone });
  if (!parsed.valid) return { failed: `This link does not give a calendar. Copy the calendar link from ${siteName(calendar.source)} again and paste it here.` };

  const today = ctx.today;
  const horizon = addDays(today, IMPORT_DAYS);
  const uids = new Set<string>();
  const events = parsed.events.filter((e) => {
    // Our own events sent back to us, events that are over, and the same event twice are left out.
    if (e.end <= today || e.start > horizon || e.uid.endsWith(OWN_UID_SUFFIX) || uids.has(e.uid)) return false;
    uids.add(e.uid);
    return true;
  });

  await adoptOrphans(calendar, uids);
  const stays = await planStays(calendar, events, ctx);
  const seen = new Set(stays.map((s) => s.ref));
  const counts: Counts = { created: 0, updated: 0, cancelled: 0, issues: 0 };
  let problem: string | null = null;

  // 1. Stays that are no longer in the site's calendar: the site cancelled them. First, so their rooms are free for what follows.
  const before = await prisma.booking.findMany({
    where: { channelCalendarId: calendar.id, status: "reserved", checkInDate: { gte: dateFromKey(today) }, channelRef: { not: null } },
    select: { channelRef: true },
  });
  for (const b of before) {
    if (seen.has(b.channelRef!)) continue;
    const done = await cancelChannelStay(b.channelRef!, calendar.source, ctx, goneReason(calendar.source));
    if (done.outcome === "cancelled") counts.cancelled += 1;
  }
  // …and questions about stays that never found a room and are gone now need no answer any more.
  const waiting = await prisma.channelIssue.findMany({
    where: { status: "open", kind: { in: ["clash", "no_room"] }, channelRef: { startsWith: `ical:${calendar.id}:` }, bookingId: null },
    select: { channelRef: true },
  });
  for (const ref of new Set(waiting.map((i) => i.channelRef!))) {
    if (!seen.has(ref)) await cancelChannelStay(ref, calendar.source, ctx);
  }

  // 2. A stay we cancelled because it had left the calendar, and that is back: it is booked again as a new booking.
  if (seen.size) {
    const back = await prisma.booking.findMany({ where: { channelRef: { in: [...seen] }, status: "cancelled", cancelReason: goneReason(calendar.source) }, select: { id: true, channelRef: true } });
    for (const b of back) await prisma.booking.update({ where: { id: b.id }, data: { channelRef: `${b.channelRef}~${b.id}` } });
  }

  // 3. Write every stay. Writing the same stay again changes nothing.
  const issueIds: string[] = [];
  for (const stay of stays) {
    try {
      const done = await saveChannelStay(stay, ctx);
      if (done.outcome === "created") counts.created += 1;
      else if (done.outcome === "updated") counts.updated += 1;
      else if (done.outcome === "issue" && done.issueId) issueIds.push(done.issueId);
    } catch (error) {
      console.error(`A stay from calendar link ${calendar.id} could not be saved`, error);
      problem = "One stay from this calendar could not be saved. Press Read now to try again.";
    }
  }
  // Only questions that are new this time are counted: an old one is already waiting on the screen.
  if (issueIds.length) counts.issues = await prisma.channelIssue.count({ where: { id: { in: issueIds }, createdAt: { gte: startedAt } } });
  return { counts, events: stays.length, problem };
}

/**
 * Reads the booking sites' calendar links and writes what they sold into our bookings.
 * A link read in the last few minutes is skipped unless `force`.
 */
export async function syncCalendars(ctx: BillingContext, opts: { force?: boolean; calendarId?: string } = {}): Promise<CalendarSyncResult> {
  const result: CalendarSyncResult = { read: 0, created: 0, updated: 0, cancelled: 0, issues: 0, errors: 0 };
  const calendars = await prisma.channelCalendar.findMany({
    where: { active: true, importUrl: { not: null }, ...(opts.calendarId && { id: opts.calendarId }) },
    include: { room: { select: { type: true, roomNumber: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const calendar of calendars) {
    // Take the turn first, so two readers at the same moment (a screen and the timer) do not do the work twice.
    const turn = await prisma.channelCalendar.updateMany({
      where: { id: calendar.id, ...(!opts.force && { OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - READ_EVERY_MS) } }] }) },
      data: { lastSyncAt: new Date() },
    });
    if (!turn.count) continue;

    const issueRef = `ical:${calendar.id}`;
    const outcome = await readCalendar(calendar, ctx).catch((error) => {
      console.error(`Calendar link ${calendar.id} could not be read`, error);
      return { failed: "Something went wrong while reading this calendar. It will be tried again in a few minutes." };
    });
    if ("failed" in outcome) {
      result.errors += 1;
      await prisma.channelCalendar.updateMany({ where: { id: calendar.id }, data: { lastSyncAt: new Date(), lastError: outcome.failed.slice(0, 500) } });
      // The second time in a row, a person is asked to look: while the link cannot be read, the site's bookings do not arrive.
      if (calendar.lastError) {
        const where = calendar.room ? `Room ${calendar.room.roomNumber}` : `${label(calendar.roomType ?? "")} rooms`;
        const issue = await raiseChannelIssue({
          source: calendar.source,
          kind: "sync",
          title: `The calendar link of ${siteName(calendar.source)} for ${where} cannot be read`,
          details: `${outcome.failed} Until this is put right, bookings made on ${siteName(calendar.source)} do not come into your bookings by themselves. Open Booking sites → Calendar links.`,
          channelRef: issueRef,
        });
        // Asked before, and closed by itself when the link worked again: ask again.
        if (!issue.isNew) await prisma.channelIssue.updateMany({ where: { id: issue.id, status: "closed", closedBy: null }, data: { status: "open", closedAt: null } });
      }
      continue;
    }
    result.read += 1;
    result.created += outcome.counts.created;
    result.updated += outcome.counts.updated;
    result.cancelled += outcome.counts.cancelled;
    result.issues += outcome.counts.issues;
    await prisma.channelCalendar.updateMany({ where: { id: calendar.id }, data: { lastSyncAt: new Date(), lastError: outcome.problem, lastEvents: outcome.events } });
    await prisma.channelIssue.updateMany({ where: { channelRef: issueRef, kind: "sync", status: "open" }, data: { status: "closed", closedAt: new Date() } });
  }
  return result;
}
