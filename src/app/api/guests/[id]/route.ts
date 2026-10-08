import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, withAdmin, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { guestData, guestSchema } from "@/lib/guests";
import { getBillingContext } from "@/lib/settings";
import { bookingInclude, serializeBooking } from "@/lib/bookings";
import { deleteStoredFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const guest = await prisma.guest.findUnique({ where: { id }, include: { documents: { orderBy: { createdAt: "desc" } } } });
    if (!guest) fail("Guest not found", 404);
    const ctx = await getBillingContext();
    const bookings = await prisma.booking.findMany({
      where: { guestId: id },
      include: bookingInclude,
      orderBy: { checkInDate: "desc" },
    });
    const serialized = bookings.map((b) => serializeBooking(b, ctx));
    const stays = serialized.filter((b) => b.status === "checked_out" || b.status === "checked_in");
    return NextResponse.json({
      ...guest,
      bookings: serialized,
      summary: {
        stays: stays.length,
        nights: stays.reduce((s, b) => s + b.folio.nightCount, 0),
        spent: serialized.reduce((s, b) => s + b.folio.netPaid, 0),
        owed: serialized.filter((b) => b.status !== "cancelled" && b.status !== "reserved").reduce((s, b) => s + Math.max(0, b.folio.balance), 0),
      },
    });
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = guestSchema.partial().parse(await request.json());
    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest) fail("Guest not found", 404);
    const updated = await prisma.guest.update({ where: { id }, data: guestData(body), include: { documents: true } });
    await logActivity(user, "Guest updated", `${updated.firstName} ${updated.lastName}`.trim());
    return NextResponse.json(updated);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const guest = await prisma.guest.findUnique({ where: { id }, include: { documents: true, _count: { select: { bookings: true } } } });
    if (!guest) fail("Guest not found", 404);
    if (guest._count.bookings > 0) fail("This guest has bookings, so the record is kept for your accounts.");
    for (const doc of guest.documents) {
      await deleteStoredFile(doc.filePath).catch(() => undefined);
    }
    await prisma.guest.delete({ where: { id } });
    await logActivity(user, "Guest deleted", `${guest.firstName} ${guest.lastName}`.trim());
    return NextResponse.json({ success: true });
  });
}
