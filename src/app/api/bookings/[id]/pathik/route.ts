import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { bookingLabel } from "@/lib/bookings";

type Params = { params: Promise<{ id: string }> };

/** The front desk marks a stay as entered in the police guest register (Pathik), or takes the mark off. */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const { entered } = z.object({ entered: z.boolean() }).parse(await request.json());
    const booking = await prisma.booking.findUnique({ where: { id }, include: { guest: true, room: true } });
    if (!booking) fail("Booking not found", 404);
    const updated = await prisma.booking.update({
      where: { id },
      data: entered ? { pathikAt: new Date(), pathikByName: user.name } : { pathikAt: null, pathikByName: null },
      select: { pathikAt: true, pathikByName: true },
    });
    await logActivity(user, entered ? "Entered in Pathik" : "Pathik mark removed", bookingLabel(booking));
    return NextResponse.json(updated);
  });
}
