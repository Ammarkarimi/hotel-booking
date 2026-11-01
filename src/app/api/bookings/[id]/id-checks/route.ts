import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, isAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { bookingLabel } from "@/lib/bookings";
import { DOCUMENT_TYPES, label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

// Nothing from the ID is sent here: the Aadhaar QR is checked on the staff phone.
const schema = z.object({
  person: z.string().trim().max(80).nullable().default(null), // null = the guest who booked
  method: z.enum(["aadhaar_qr", "id_seen"]),
  idType: z.enum(DOCUMENT_TYPES).optional(),
});

/** Staff record that they checked one adult's ID. */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const body = schema.parse(await request.json());
    if (body.method === "id_seen" && !body.idType) fail("Please choose which ID you saw");
    const booking = await prisma.booking.findUnique({ where: { id }, include: { guest: true, room: true } });
    if (!booking) fail("Booking not found", 404);
    if (booking.status === "cancelled" || booking.status === "no_show") fail("This booking is closed");
    const check = await prisma.idCheck.create({
      data: {
        hotelId: currentHotelId(),
        bookingId: id,
        person: body.person || null,
        method: body.method,
        idType: body.method === "id_seen" ? body.idType : "aadhar",
        checkedById: user.id,
        checkedByName: user.name,
      },
    });
    const who = body.person || `${booking.guest.firstName} ${booking.guest.lastName}`.trim();
    await logActivity(
      user,
      body.method === "aadhaar_qr" ? "Aadhaar verified (QR)" : "ID checked",
      `${bookingLabel(booking)}: ${who}${body.method === "id_seen" ? `, ${label(body.idType)}` : ""}`
    );
    return NextResponse.json(check, { status: 201 });
  });
}

/** Undo a check done by mistake: the owner, or the person who did it on the same day. */
export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const checkId = new URL(request.url).searchParams.get("checkId") || "";
    const check = await prisma.idCheck.findFirst({ where: { id: checkId, bookingId: id } });
    if (!check) fail("ID check not found", 404);
    const sameDay = check.checkedById === user.id && Date.now() - check.createdAt.getTime() < 12 * 60 * 60 * 1000;
    if (!isAdmin(user) && !sameDay) fail("Only the owner can remove this", 403);
    await prisma.idCheck.delete({ where: { id: check.id } });
    await logActivity(user, "ID check removed", check.person ?? "guest");
    return NextResponse.json({ ok: true });
  });
}
