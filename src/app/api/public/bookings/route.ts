import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { dateFromKey } from "@/lib/dates";
import { findAvailableRooms, findConflicts, lockRooms, parseStayDate, validateStay } from "@/lib/bookings";
import { assertWebsiteOpen, noStore, validatePublicStay } from "@/lib/public";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  roomType: z.string().min(1, "Please choose a room"),
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
  firstName: z.string().trim().min(1, "Please enter your name").max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().min(6, "Please enter a valid phone number").max(20).regex(/^[+\d][\d\s-]+$/, "Please enter a valid phone number"),
  email: z.string().trim().email("Please enter a valid email").optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
  website: z.string().optional(), // honeypot: real people never fill this hidden field
});

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`public-booking:${clientIp(request.headers)}`, 5, 60 * 60 * 1000)) {
      fail("Too many bookings from this device. Please call the hotel.", 429);
    }
    const body = schema.parse(await request.json());
    if (body.website) fail("Could not complete the booking");
    const ctx = await getBillingContext();
    assertWebsiteOpen(ctx.settings);
    const checkIn = parseStayDate(body.checkIn, "arrival");
    const checkOut = parseStayDate(body.checkOut, "leaving");
    validateStay(checkIn, checkOut);
    validatePublicStay(ctx, checkIn, checkOut);
    const guests = body.adults + body.children;

    const candidates = (await findAvailableRooms(ctx, { checkIn, checkOut, guests }))
      .filter((r) => r.room.type === body.roomType)
      .sort((a, b) => a.room.pricePerNight - b.room.pricePerNight);
    if (candidates.length === 0) fail("Sorry, this room type was just booked by someone else. Please choose another.", 409);

    const booking = await prisma.$transaction(async (tx) => {
      const roomIds = candidates.map((c) => c.room.id);
      await lockRooms(tx, roomIds);
      const busy = new Set((await findConflicts({ roomIds, checkIn, checkOut, today: ctx.today }, tx)).map((c) => c.roomId));
      const pick = candidates.find((c) => !busy.has(c.room.id));
      if (!pick) fail("Sorry, this room type was just booked by someone else. Please choose another.", 409);

      const existing = await tx.guest.findFirst({
        where: { phone: body.phone, firstName: { equals: body.firstName, mode: "insensitive" } },
      });
      const guest =
        existing ??
        (await tx.guest.create({
          data: { firstName: body.firstName, lastName: body.lastName, phone: body.phone, email: body.email || null },
        }));
      if (existing && body.email && !existing.email) {
        await tx.guest.update({ where: { id: existing.id }, data: { email: body.email } });
      }

      return tx.booking.create({
        data: {
          guestId: guest.id,
          roomId: pick.room.id,
          checkInDate: dateFromKey(checkIn),
          checkOutDate: dateFromKey(checkOut),
          adults: body.adults,
          children: body.children,
          source: "website",
          ratePerNight: pick.room.pricePerNight,
          notes: body.notes ? `Guest note: ${body.notes}` : null,
        },
        include: { guest: true, room: true },
      });
    });

    await logActivity(null, "Website booking", `#${booking.number} for ${booking.guest.firstName} ${booking.guest.lastName} (Room ${booking.room.roomNumber}), ${checkIn} to ${checkOut}`);
    return noStore({ token: booking.publicToken, number: booking.number }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
