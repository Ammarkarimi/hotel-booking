// Channex: sending the hotel's free rooms and prices to booking sites, and bringing their bookings in.
// The API calls are in src/lib/channex.ts; what is sent and how a booking is read is in src/lib/channex-map.ts.
import { currentHotelId, prisma } from "./db";
import { addDays, dateFromKey } from "./dates";
import { ACTIVE_STATUSES } from "./bookings";
import { cancelChannelStay, raiseChannelIssue, saveChannelStay } from "./channel-bookings";
import { siteName } from "./channels";
import { nightAdjustment } from "./pricing";
import { label } from "./utils";
import type { BillingContext } from "./settings";
import * as channex from "./channex";
import { ChannexError, channexConfigured, channexSandbox, type ChannexRevision } from "./channex";
import {
  ariHash,
  buildAri,
  channexRefPrefix,
  mapRevision,
  parseRoomMap,
  propertyPayload,
  PUSH_DAYS,
  ratePlanPayload,
  roomTypePayload,
  roomTypeSpecs,
  sellingRate,
  stayDates,
  WEBHOOK_HEADER,
  webhookSecret,
  type MapRoom,
  type RoomMap,
} from "./channex-map";

export { channexConfigured };

export interface ChannexSyncResult {
  /** The hotel is joined to Channex. */
  connected: boolean;
  /** Bookings, changes and cancellations brought in. */
  pulled: number;
  /** Free rooms or prices were sent (false when nothing had changed). */
  pushed: boolean;
  error: string | null;
}

type Link = NonNullable<Awaited<ReturnType<typeof getChannexLink>>>;

/** The current hotel's link to Channex, or null when it has not connected. */
export function getChannexLink() {
  return prisma.channexLink.findFirst();
}

const messageOf = (error: unknown) => (error instanceof ChannexError ? error.message : "Something went wrong. It will be tried again shortly.");

function logUnexpected(what: string, error: unknown) {
  if (!(error instanceof ChannexError)) console.error(what, error);
}

// lastError holds up to two lines, one about sending and one about reading, so that a good
// reading does not hide a failed sending (and the other way round).
const SENDING = "Sending free rooms and prices: ";
const READING = "Reading bookings: ";

function withError(current: string | null, part: typeof SENDING | typeof READING, message: string | null): string | null {
  const others = (current ?? "").split("\n").filter((line) => line && !line.startsWith(part));
  return [...others, ...(message ? [`${part}${message}`.slice(0, 600)] : [])].join("\n") || null;
}

async function noteError(part: typeof SENDING | typeof READING, message: string | null, more: Record<string, unknown> = {}) {
  const link = await getChannexLink();
  if (!link) return;
  await prisma.channexLink.update({ where: { id: link.id }, data: { lastError: withError(link.lastError, part, message), ...more } });
}

/** One thing at a time per hotel: two updates sent at once could arrive in the wrong order. */
const queues = new Map<string, Promise<unknown>>();
function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const hotelId = currentHotelId();
  const next = (queues.get(hotelId) ?? Promise.resolve()).then(fn, fn);
  const settled = next.catch(() => undefined);
  queues.set(hotelId, settled);
  void settled.then(() => {
    if (queues.get(hotelId) === settled) queues.delete(hotelId);
  });
  return next;
}

function roomsForMap(): Promise<MapRoom[]> {
  return prisma.room.findMany({ select: { id: true, type: true, capacity: true, pricePerNight: true, status: true } });
}

// ---- Connecting -------------------------------------------------------------------------------

/**
 * Makes sure every room type of the hotel has its room type and "Standard rate" in Channex, and
 * that Channex knows how many rooms each has. The map is saved after every step, so a failure
 * half-way leaves nothing made twice.
 */
async function refreshRoomMap(link: Link, rooms: MapRoom[], ctx: BillingContext): Promise<RoomMap> {
  const map = parseRoomMap(link.roomMap);
  const save = () => prisma.channexLink.update({ where: { id: link.id }, data: { roomMap: JSON.stringify(map) } });
  for (const spec of roomTypeSpecs(rooms)) {
    let entry = map[spec.type];
    if (!entry) {
      const roomTypeId = await channex.createRoomType(roomTypePayload(link.propertyId, spec));
      entry = map[spec.type] = { roomTypeId, ratePlanId: "", rooms: spec.countOfRooms };
      await save();
    }
    if (!entry.ratePlanId) {
      entry.ratePlanId = await channex.createRatePlan(ratePlanPayload(link.propertyId, entry.roomTypeId, spec, ctx.settings.currency, link.markup));
      await save();
    }
    if (entry.rooms !== spec.countOfRooms) {
      await channex.updateRoomType(entry.roomTypeId, { count_of_rooms: spec.countOfRooms });
      entry.rooms = spec.countOfRooms;
      await save();
    }
  }
  return map;
}

function webhookSecretKey() {
  return process.env.CHANNEX_WEBHOOK_SECRET || process.env.JWT_SECRET || "";
}

/** The value Channex must send in the secret header for this property; null when no secret is set on the server. */
export function expectedWebhookSecret(propertyId: string): string | null {
  const key = webhookSecretKey();
  return key ? webhookSecret(propertyId, key) : null;
}

/**
 * Asks Channex to tell us at once when a booking comes in. Without it bookings still arrive, a few
 * minutes later, when the timer or a screen checks. Returns why it could not be set up, or null.
 */
export async function ensureChannexWebhook(origin: string): Promise<string | null> {
  const link = await getChannexLink();
  if (!link || link.webhookId) return null;
  const secret = expectedWebhookSecret(link.propertyId);
  if (!secret) return "no secret is set on the server";
  try {
    const webhookId = await channex.createWebhook({
      propertyId: link.propertyId,
      // Channex allows one webhook per address in an account, so each hotel gets an address of its own.
      callbackUrl: `${origin.replace(/\/+$/, "")}/api/public/channex/webhook?hotel=${encodeURIComponent(link.hotelId)}`,
      headers: { [WEBHOOK_HEADER]: secret },
    });
    await prisma.channexLink.update({ where: { id: link.id }, data: { webhookId } });
    return null;
  } catch (error) {
    logUnexpected("The Channex webhook could not be made", error);
    return messageOf(error);
  }
}

export interface ConnectResult {
  /** Free rooms and prices were sent. */
  pushed: boolean;
  /** Something that did not work, in plain words; the hotel is connected all the same. */
  warning: string | null;
}

/**
 * Joins the hotel to Channex: a property, a room type and a "Standard rate" for each of our room
 * types, and the webhook. Then sends a year of free rooms and prices. Safe to press again: what
 * was made the first time is kept, and only what is missing is made.
 * Throws a ChannexError when the property or a room type cannot be made.
 */
export async function connectChannex(ctx: BillingContext, origin: string): Promise<ConnectResult> {
  let link = await getChannexLink();
  if (!link) {
    const propertyId = await channex.createProperty(propertyPayload(ctx.settings));
    // Saved at once: if a later step fails, pressing Connect again carries on with this property.
    link = await prisma.channexLink.create({ data: { hotelId: currentHotelId(), propertyId } });
  }
  const rooms = await roomsForMap();
  await oneAtATime(() => refreshRoomMap(link, rooms, ctx));
  const webhookProblem = await ensureChannexWebhook(origin);
  const push = await pushChannex(ctx, { force: true });
  const warning =
    push.error ??
    (webhookProblem
      ? `Connected. Channex could not be asked to tell us about bookings at once (${webhookProblem}), so new bookings will arrive a few minutes later instead.`
      : null);
  return { pushed: push.pushed, warning };
}

/** Stops sending and reading. The hotel's property stays in Channex, with the sites the owner joined there. */
export async function disconnectChannex(): Promise<void> {
  const link = await getChannexLink();
  if (!link) return;
  if (link.webhookId) {
    try {
      await channex.deleteWebhook(link.webhookId);
    } catch (error) {
      // Not worth stopping for: a message for a hotel without a link is ignored.
      logUnexpected("The Channex webhook could not be removed", error);
    }
  }
  await prisma.channexLink.delete({ where: { id: link.id } });
}

// ---- Sending free rooms and prices ------------------------------------------------------------

export interface ChannexPushResult {
  /** Something was sent (false when nothing had changed, or it failed). */
  pushed: boolean;
  error: string | null;
}

async function pushNow(ctx: BillingContext, force: boolean): Promise<ChannexPushResult> {
  const link = await getChannexLink();
  if (!link) return { pushed: false, error: null };
  try {
    const rooms = await roomsForMap();
    const roomMap = await refreshRoomMap(link, rooms, ctx);
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        checkInDate: { lt: dateFromKey(addDays(ctx.today, PUSH_DAYS)) },
        // A guest who has not left yet holds the room even after the planned leaving date.
        OR: [{ checkOutDate: { gt: dateFromKey(ctx.today) } }, { status: "checked_in" }],
      },
      select: { roomId: true, status: true, checkInDate: true, checkOutDate: true },
    });
    const ari = buildAri({
      propertyId: link.propertyId,
      roomMap,
      rooms,
      stays: stayDates(bookings, ctx.today),
      rules: ctx.rules,
      markup: link.markup,
      currency: ctx.settings.currency,
      today: ctx.today,
    });
    // The dates are part of the hash, so the first check of each day sends the year again (and adds its new last day).
    const hash = ariHash(ari);
    if (!force && hash === link.pushedHash) return { pushed: false, error: null };

    // One request each, with everything in it: Channex allows 10 a minute per property.
    const warnings = [...(await channex.sendAvailability(ari.availability)), ...(await channex.sendRestrictions(ari.restrictions))];
    const error = warnings.length
      ? `Channex did not accept ${warnings.length === 1 ? "one entry" : `${warnings.length} entries`}: ${warnings.slice(0, 3).join(" | ")}${warnings.length > 3 ? " …" : ""}`.slice(0, 500)
      : null;
    // Entries Channex refused would be refused again, so the hash is saved all the same and the reason is shown.
    await noteError(SENDING, error, { pushedHash: hash, lastPushAt: new Date() });
    return { pushed: true, error };
  } catch (error) {
    logUnexpected("Free rooms and prices could not be sent to Channex", error);
    const message = messageOf(error);
    // The saved hash stays as it was, so the next check sends again.
    await noteError(SENDING, message).catch(() => undefined);
    return { pushed: false, error: message };
  }
}

/**
 * Sends the next year's free rooms and prices for every room type, when they differ from what was
 * sent last (or always, with `force`). Never throws: a failure is saved on the link and returned.
 */
export function pushChannex(ctx: BillingContext, opts: { force?: boolean } = {}): Promise<ChannexPushResult> {
  if (!channexConfigured()) return Promise.resolve({ pushed: false, error: null });
  return oneAtATime(() => pushNow(ctx, !!opts.force));
}

// ---- Bringing bookings in ---------------------------------------------------------------------

/** Writes one new, changed or cancelled booking into our books. Returns how many stays it changed. */
async function handleRevision(rev: ChannexRevision, roomMap: RoomMap, ctx: BillingContext): Promise<number> {
  const mapped = mapRevision(rev, roomMap, ctx.settings.currency);
  const site = siteName(mapped.source);
  const known = (await prisma.booking.findMany({ where: { channelRef: { startsWith: channexRefPrefix(mapped.bookingId) } }, select: { channelRef: true } }))
    .map((b) => b.channelRef)
    .filter((ref): ref is string => !!ref);
  let changed = 0;

  if (mapped.status === "cancelled") {
    for (const ref of new Set([...known, ...mapped.refs])) {
      const result = await cancelChannelStay(ref, mapped.source, ctx);
      if (result.outcome !== "unchanged") changed += 1;
    }
    return changed;
  }

  for (const room of mapped.unmapped) {
    const issue = await raiseChannelIssue({ source: mapped.source, kind: "sync", title: room.title, details: room.details, channelRef: room.ref });
    if (issue.isNew) changed += 1;
  }
  for (const stay of mapped.stays) {
    const result = await saveChannelStay(stay, ctx);
    if (result.outcome !== "unchanged") changed += 1;
  }
  if (!mapped.refs.length) {
    // A booking without a single readable room: never drop it silently.
    await raiseChannelIssue({
      source: mapped.source,
      kind: "sync",
      title: `${site} sent a booking without room details${rev.ota_reservation_code ? ` (booking number ${rev.ota_reservation_code})` : ""}`,
      details: `Arriving ${rev.arrival_date ?? "?"}, leaving ${rev.departure_date ?? "?"}. Open ${site} to see this booking, and add it by hand.`,
      channelRef: `${channexRefPrefix(mapped.bookingId)}none`,
    });
    return changed;
  }
  // A room taken out of the booking on the site.
  for (const ref of known.filter((r) => !mapped.refs.includes(r))) {
    const result = await cancelChannelStay(ref, mapped.source, ctx, `Removed from the booking on ${site}`);
    if (result.outcome !== "unchanged") changed += 1;
  }
  return changed;
}

export interface ChannexPullResult {
  /** Bookings, changes and cancellations brought in. */
  pulled: number;
  error: string | null;
}

const PAGE = 50;

/**
 * Reads what the booking sites sold, changed or cancelled since last time and writes it into our
 * books. Each one is confirmed to Channex only after it is saved (or a person was asked to look);
 * one that cannot be saved stays in Channex's list and is tried again next time.
 */
export function pullChannexBookings(ctx: BillingContext): Promise<ChannexPullResult> {
  if (!channexConfigured()) return Promise.resolve({ pulled: 0, error: null });
  // A webhook and a screen may ask at the same moment: one reading at a time.
  return oneAtATime(() => pullNow(ctx));
}

async function pullNow(ctx: BillingContext): Promise<ChannexPullResult> {
  const link = await getChannexLink();
  if (!link) return { pulled: 0, error: null };
  const roomMap = parseRoomMap(link.roomMap);
  const tried = new Set<string>();
  let pulled = 0;
  let failed = 0;
  try {
    // Confirmed revisions leave the list, so the same page is read again until nothing new is on it.
    for (let page = 1, rounds = 0; rounds < 40; rounds++) {
      const revisions = await channex.bookingFeed(link.propertyId, page, PAGE);
      const fresh = revisions.filter((r) => r.id && r.booking_id && !tried.has(r.id));
      let confirmed = 0;
      for (const rev of fresh) {
        tried.add(rev.id);
        try {
          pulled += await handleRevision(rev, roomMap, ctx);
        } catch (error) {
          failed += 1;
          console.error(`Channex booking ${rev.booking_id} could not be saved; it will be tried again`, error);
          continue;
        }
        try {
          await channex.ackRevision(rev.id);
          confirmed += 1;
        } catch (error) {
          // It is in our books; it comes again next time and changes nothing.
          logUnexpected(`Channex booking ${rev.booking_id} could not be confirmed`, error);
        }
      }
      if (revisions.length < PAGE) break;
      if (confirmed === 0) page += 1;
    }
    const error = failed ? `${failed === 1 ? "One booking" : `${failed} bookings`} from a booking site could not be saved. It will be tried again; if this stays, tell your software provider.` : null;
    await noteError(READING, error, { lastPullAt: new Date() });
    return { pulled, error };
  } catch (error) {
    logUnexpected("Bookings could not be read from Channex", error);
    const message = messageOf(error);
    await noteError(READING, message).catch(() => undefined);
    return { pulled, error: message };
  }
}

/** Brings in what booking sites sold since last time, then sends our free rooms and prices if they changed. */
export async function syncChannex(ctx: BillingContext, opts: { force?: boolean } = {}): Promise<ChannexSyncResult> {
  if (!channexConfigured() || !(await getChannexLink())) return { connected: false, pulled: 0, pushed: false, error: null };
  const pull = await pullChannexBookings(ctx);
  const push = await pushChannex(ctx, opts);
  return { connected: true, pulled: pull.pulled, pushed: push.pushed, error: pull.error ?? push.error };
}

// ---- For the Booking sites screen -------------------------------------------------------------

export interface ChannexStatus {
  /** The software provider has switched the connection on. */
  configured: boolean;
  connected: boolean;
  /** Channex's test server: nothing reaches a real booking site. */
  sandbox: boolean;
  propertyId: string | null;
  rooms: Array<{ type: string; label: string; rooms: number; roomTypeId: string | null; priceTonight: number }>;
  /** % added to the prices sent to booking sites. */
  markup: number;
  /** Channex tells us at once about a booking (otherwise bookings arrive a few minutes later). */
  instant: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
}

export async function channexStatus(ctx: BillingContext): Promise<ChannexStatus> {
  const configured = channexConfigured();
  const link = configured ? await getChannexLink() : null;
  const roomMap = parseRoomMap(link?.roomMap);
  const markup = link?.markup ?? 0;
  const rooms = roomTypeSpecs(await roomsForMap()).map((spec) => ({
    type: spec.type,
    label: label(spec.type) || spec.type,
    rooms: spec.rooms,
    roomTypeId: roomMap[spec.type]?.roomTypeId ?? null,
    priceTonight: sellingRate(spec.basePrice, nightAdjustment(ctx.today, spec.type, ctx.rules), markup, ctx.settings.currency),
  }));
  return {
    configured,
    connected: !!link,
    sandbox: channexSandbox(),
    propertyId: link?.propertyId ?? null,
    rooms,
    markup,
    instant: !!link?.webhookId,
    lastPushAt: link?.lastPushAt?.toISOString() ?? null,
    lastPullAt: link?.lastPullAt?.toISOString() ?? null,
    lastError: link?.lastError ?? null,
  };
}
