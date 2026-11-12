// Bookings that come from a booking site by themselves (a calendar link or Channex): putting one
// in a free room, moving it when the site changes it, cancelling it when the site cancels it, and
// asking a person to look when it cannot be done safely (src/lib/channels.ts has the pure parts).
import { randomUUID } from "node:crypto";
import { currentHotelId, prisma, type Db } from "./db";
import { dateFromKey, toDateKey } from "./dates";
import { ACTIVE_STATUSES, bookingInclude, bookingLabel, findConflicts, folioFor, lockRooms, nextBookingNumber } from "./bookings";
import { logActivity } from "./activity";
import { siteName } from "./channels";
import type { BillingContext } from "./settings";

/** One stay sold by a booking site, as we want it in our books. */
export interface ChannelStay {
  /** Never changes for this stay, and is unique in the hotel: "ical:<calendar id>:<uid>", "channex:<booking id>:<n>". */
  ref: string;
  /** The booking source: airbnb, booking_com, makemytrip… */
  source: string;
  /** The calendar link it came from (calendar links only). */
  calendarId?: string | null;
  /** The room the site sold… */
  roomId?: string | null;
  /** …or a room type: any free room of the type is taken. With roomId, also where to look when that room is busy. */
  roomType?: string | null;
  checkIn: string; // date keys
  checkOut: string;
  guest: {
    firstName: string;
    lastName?: string;
    phone?: string | null;
    email?: string | null;
    nationality?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pinCode?: string | null;
  };
  adults?: number;
  children?: number;
  /** The price per night the site sold it for; left out = the room's own price. */
  ratePerNight?: number | null;
  /** Whether that price already includes the room GST; left out = the hotel's own setting. */
  pricesIncludeTax?: boolean;
  /** The site's own booking number. */
  otaReference?: string | null;
  notes?: string | null;
  /** Money the site already took from the guest for this room (it pays the hotel later). */
  prepaid?: number;
  /** Rooms booked together on the site share one groupId. */
  groupId?: string | null;
}

export type ChannelOutcome = "created" | "updated" | "unchanged" | "cancelled" | "issue";

export interface ChannelResult {
  outcome: ChannelOutcome;
  bookingId?: string;
  number?: number;
  issueId?: string;
}

export type ChannelIssueKind = "clash" | "no_room" | "change" | "cancel" | "sync";

/**
 * Asks a person to look at something from a booking site. The same thing is asked only once:
 * a second issue with the same ref, kind and title is not made, even after the first was closed.
 */
export async function raiseChannelIssue(
  issue: { source: string; kind: ChannelIssueKind; title: string; details?: string | null; channelRef?: string | null; bookingId?: string | null },
  db: Db = prisma
): Promise<{ id: string; isNew: boolean }> {
  const same = await db.channelIssue.findFirst({
    where: { kind: issue.kind, title: issue.title, channelRef: issue.channelRef ?? null },
    orderBy: { createdAt: "desc" },
  });
  if (same) return { id: same.id, isNew: false };
  const made = await db.channelIssue.create({
    data: {
      hotelId: currentHotelId(),
      source: issue.source,
      kind: issue.kind,
      title: issue.title.slice(0, 300),
      details: issue.details?.slice(0, 2000) ?? null,
      channelRef: issue.channelRef ?? null,
      bookingId: issue.bookingId ?? null,
    },
  });
  return { id: made.id, isNew: true };
}

/** The issues staff closed by hand for this stay: they dealt with it themselves, so we leave it alone. */
async function handledByHand(ref: string, db: Db) {
  return (await db.channelIssue.count({ where: { channelRef: ref, kind: { in: ["clash", "no_room"] }, status: "closed", closedBy: { not: null } } })) > 0;
}

function stayLine(stay: ChannelStay) {
  const name = `${stay.guest.firstName} ${stay.guest.lastName ?? ""}`.trim();
  const ref = stay.otaReference ? `, ${siteName(stay.source)} booking ${stay.otaReference}` : "";
  const phone = stay.guest.phone ? `, phone ${stay.guest.phone}` : "";
  return `${name}, ${stay.checkIn} to ${stay.checkOut}${ref}${phone}`;
}

/** A free room for the stay: the room the site sold if it is free, else another free room of the type. */
async function pickRoom(stay: ChannelStay, ctx: BillingContext, db: Db, excludeBookingId?: string) {
  const wanted = stay.roomId ? await db.room.findUnique({ where: { id: stay.roomId } }) : null;
  const type = stay.roomType ?? wanted?.type ?? null;
  const sameType = type ? await db.room.findMany({ where: { type, status: { not: "maintenance" } }, orderBy: { roomNumber: "asc" } }) : [];
  const candidates = [...(wanted && wanted.status !== "maintenance" ? [wanted] : []), ...sameType.filter((r) => r.id !== wanted?.id)];
  if (!candidates.length) return { room: null, wanted, type };
  await lockRooms(
    db,
    candidates.map((r) => r.id)
  );
  const conflicts = await findConflicts({ roomIds: candidates.map((r) => r.id), checkIn: stay.checkIn, checkOut: stay.checkOut, today: ctx.today, excludeBookingId }, db);
  const busy = new Set(conflicts.map((c) => c.roomId));
  const room = candidates.find((r) => !busy.has(r.id)) ?? null;
  const clash = wanted ? conflicts.find((c) => c.roomId === wanted.id) : conflicts[0];
  return { room, wanted, type, clash };
}

/**
 * Writes a booking site's stay into our books: a new booking in a free room, or the dates of the
 * booking it already made. When no room is free, or the guest is already staying, nothing is
 * changed and an issue asks a person to look. Safe to call again and again with the same stay.
 */
export async function saveChannelStay(stay: ChannelStay, ctx: BillingContext): Promise<ChannelResult> {
  const site = siteName(stay.source);
  if (stay.checkOut <= stay.checkIn) return { outcome: "unchanged" };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel:${stay.ref}`}))`;
    const existing = await tx.booking.findFirst({ where: { channelRef: stay.ref }, include: bookingInclude });

    if (!existing) {
      if (await handledByHand(stay.ref, tx)) return { outcome: "unchanged" as const };
      const { room, wanted, type, clash } = await pickRoom(stay, ctx, tx);
      if (!room) {
        const where = wanted ? `Room ${wanted.roomNumber}` : type ? `a ${type} room` : "a room";
        const issue = await raiseChannelIssue(
          {
            source: stay.source,
            kind: clash ? "clash" : "no_room",
            title: `${site} sold ${where} for ${stay.checkIn} to ${stay.checkOut}, but it is not free`,
            details:
              `${stayLine(stay)}.` +
              (clash ? ` The room is taken by booking #${clash.number} (${clash.guest.firstName} ${clash.guest.lastName}).`.replace(" )", ")") : "") +
              ` Move one of the two bookings to another room, or call the guest. This stay is NOT in your bookings yet.`,
            channelRef: stay.ref,
          },
          tx
        );
        return { outcome: "issue" as const, issueId: issue.id };
      }

      const phone = (stay.guest.phone ?? "").trim();
      const known = phone ? await tx.guest.findFirst({ where: { phone, firstName: { equals: stay.guest.firstName, mode: "insensitive" } } }) : null;
      const guest =
        known ??
        (await tx.guest.create({
          data: {
            hotelId: currentHotelId(),
            firstName: stay.guest.firstName,
            lastName: stay.guest.lastName ?? "",
            phone,
            email: stay.guest.email || null,
            nationality: stay.guest.nationality || "Indian",
            address: stay.guest.address || null,
            city: stay.guest.city || null,
            state: stay.guest.state || null,
            pinCode: stay.guest.pinCode || null,
          },
        }));
      const moved = wanted && room.id !== wanted.id ? `Sold on ${site} as Room ${wanted.roomNumber}, which was taken: put in Room ${room.roomNumber}.` : null;
      const created = await tx.booking.create({
        data: {
          hotelId: currentHotelId(),
          number: await nextBookingNumber(tx),
          guestId: guest.id,
          roomId: room.id,
          checkInDate: dateFromKey(stay.checkIn),
          checkOutDate: dateFromKey(stay.checkOut),
          adults: Math.max(1, stay.adults ?? 1),
          children: Math.max(0, stay.children ?? 0),
          source: stay.source,
          ratePerNight: stay.ratePerNight ?? room.pricePerNight,
          fixedRate: stay.ratePerNight != null,
          pricesIncludeTax: stay.pricesIncludeTax ?? ctx.settings.roomPricesIncludeTax,
          notes: [stay.notes, moved].filter(Boolean).join("\n") || null,
          otaReference: stay.otaReference || null,
          channelRef: stay.ref,
          channelCalendarId: stay.calendarId ?? null,
          groupId: stay.groupId ?? null,
        },
        include: { guest: true, room: true },
      });
      if (stay.prepaid && stay.prepaid > 0) {
        await tx.payment.create({
          data: { hotelId: currentHotelId(), bookingId: created.id, amount: stay.prepaid, method: "ota", type: "advance", notes: `Paid on ${site}`, receivedBy: site },
        });
      }
      // The room is found now: an earlier "not free" question about this stay is answered.
      await tx.channelIssue.updateMany({ where: { channelRef: stay.ref, status: "open", kind: { in: ["clash", "no_room"] } }, data: { status: "closed", closedAt: new Date() } });
      return { outcome: "created" as const, bookingId: created.id, number: created.number, label: bookingLabel(created) };
    }

    // The stay is in our books already. Only its dates (and its price, before the guest arrives) follow the site.
    const sameDates = toDateKey(existing.checkInDate) === stay.checkIn && toDateKey(existing.checkOutDate) === stay.checkOut;
    const newRate = stay.ratePerNight != null && Math.abs(stay.ratePerNight - existing.ratePerNight) > 0.005 && !existing.originalPrice ? stay.ratePerNight : null;
    if (!ACTIVE_STATUSES.includes(existing.status)) return { outcome: "unchanged" as const, bookingId: existing.id, number: existing.number };
    if (sameDates && newRate === null) return { outcome: "unchanged" as const, bookingId: existing.id, number: existing.number };
    if (existing.status !== "reserved") {
      if (sameDates) return { outcome: "unchanged" as const, bookingId: existing.id, number: existing.number };
      const issue = await raiseChannelIssue(
        {
          source: stay.source,
          kind: "change",
          title: `${site} changed the dates of booking #${existing.number} to ${stay.checkIn} – ${stay.checkOut}, but the guest is already staying`,
          details: `${bookingLabel(existing)} is ${toDateKey(existing.checkInDate)} to ${toDateKey(existing.checkOutDate)} in your bookings. Change the leaving date on the booking if the guest agreed.`,
          channelRef: stay.ref,
          bookingId: existing.id,
        },
        tx
      );
      return { outcome: "issue" as const, issueId: issue.id, bookingId: existing.id, number: existing.number };
    }
    let roomId = existing.roomId;
    if (!sameDates) {
      // Stay in the same room when it is free for the new dates; otherwise another room of the type.
      const { room } = await pickRoom({ ...stay, roomId: existing.roomId, roomType: stay.roomType ?? existing.room.type }, ctx, tx, existing.id);
      if (!room) {
        const issue = await raiseChannelIssue(
          {
            source: stay.source,
            kind: "change",
            title: `${site} changed the dates of booking #${existing.number} to ${stay.checkIn} – ${stay.checkOut}, but no room is free for them`,
            details: `${bookingLabel(existing)} is still ${toDateKey(existing.checkInDate)} to ${toDateKey(existing.checkOutDate)} in your bookings. Move another booking, or call the guest.`,
            channelRef: stay.ref,
            bookingId: existing.id,
          },
          tx
        );
        return { outcome: "issue" as const, issueId: issue.id, bookingId: existing.id, number: existing.number };
      }
      roomId = room.id;
    }
    await tx.booking.update({
      where: { id: existing.id },
      data: {
        roomId,
        checkInDate: dateFromKey(stay.checkIn),
        checkOutDate: dateFromKey(stay.checkOut),
        ...(newRate !== null && { ratePerNight: newRate, fixedRate: true }),
        ...(stay.adults && { adults: Math.max(1, stay.adults) }),
        ...(stay.children !== undefined && { children: Math.max(0, stay.children) }),
      },
    });
    return { outcome: "updated" as const, bookingId: existing.id, number: existing.number, label: bookingLabel(existing) };
  });

  const { label, ...rest } = result as ChannelResult & { label?: string };
  if (result.outcome === "created") await logActivity({ id: null, name: site }, `Booking from ${site}`, `${label}, ${stay.checkIn} to ${stay.checkOut}`);
  if (result.outcome === "updated") await logActivity({ id: null, name: site }, `Booking changed on ${site}`, `${label}: now ${stay.checkIn} to ${stay.checkOut}`);
  return rest;
}

/**
 * The site cancelled a stay. A booking that has not started is cancelled; when the guest is
 * already staying, or money was taken, a person is asked to look.
 */
export async function cancelChannelStay(ref: string, source: string, ctx: BillingContext, reason?: string): Promise<ChannelResult> {
  const site = siteName(source);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel:${ref}`}))`;
    const booking = await tx.booking.findFirst({ where: { channelRef: ref }, include: bookingInclude });
    // Never made it into our books: nothing to cancel, and the "not free" question is answered.
    await tx.channelIssue.updateMany({ where: { channelRef: ref, status: "open", kind: { in: ["clash", "no_room", "change"] } }, data: { status: "closed", closedAt: new Date() } });
    if (!booking || !ACTIVE_STATUSES.includes(booking.status)) return { outcome: "unchanged" as const, bookingId: booking?.id, number: booking?.number };
    if (booking.status !== "reserved") {
      const issue = await raiseChannelIssue(
        {
          source,
          kind: "cancel",
          title: `${site} cancelled booking #${booking.number}, but the guest is already staying`,
          details: `${bookingLabel(booking)}. Nothing was changed. Check with the guest and with ${site}.`,
          channelRef: ref,
          bookingId: booking.id,
        },
        tx
      );
      return { outcome: "issue" as const, issueId: issue.id, bookingId: booking.id, number: booking.number };
    }
    await tx.booking.update({ where: { id: booking.id }, data: { status: "cancelled", cancelReason: reason || `Cancelled on ${site}` } });
    const paid = folioFor(booking, ctx).netPaid;
    if (paid > 0.5) {
      await raiseChannelIssue(
        {
          source,
          kind: "cancel",
          title: `Booking #${booking.number} was cancelled on ${site} and has money paid`,
          details: `${bookingLabel(booking)} has ${paid} paid. Check whether it must be given back, and record the refund on the booking.`,
          channelRef: ref,
          bookingId: booking.id,
        },
        tx
      );
    }
    return { outcome: "cancelled" as const, bookingId: booking.id, number: booking.number, label: bookingLabel(booking) };
  });
  const { label, ...rest } = result as ChannelResult & { label?: string };
  if (result.outcome === "cancelled") await logActivity({ id: null, name: site }, `Booking cancelled on ${site}`, label);
  return rest;
}

/** A group id for rooms a site sold together in one booking. */
export function newChannelGroupId() {
  return randomUUID();
}

/** How many questions from booking sites are waiting for a person. */
export function openChannelIssues(db: Db = prisma) {
  return db.channelIssue.count({ where: { status: "open" } });
}
