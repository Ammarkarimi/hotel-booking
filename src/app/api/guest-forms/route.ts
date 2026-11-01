import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { dateFromKey, diffDays, isDateKey } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { FORM_DAYS } from "@/lib/guest-form";
import { newFormToken, serializeGuestForm } from "@/lib/guest-forms-api";

/**
 * ?count=1: how many filled-in forms are waiting for a room (for the menu badge).
 * Otherwise the list: view = received (default), waiting (sent, not filled in yet), done (booked or closed), all.
 */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("count") === "1") {
      const received = await prisma.guestForm.count({ where: { status: "submitted" } });
      return NextResponse.json({ received });
    }
    const view = searchParams.get("view") || "received";
    const where: Prisma.GuestFormWhereInput =
      view === "waiting" ? { status: "sent" } : view === "done" ? { status: { in: ["booked", "cancelled"] } } : view === "all" ? {} : { status: "submitted" };
    const forms = await prisma.guestForm.findMany({
      where,
      include: { documents: { orderBy: { createdAt: "asc" } } },
      orderBy: view === "received" ? { submittedAt: "asc" } : { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(forms.map(serializeGuestForm));
  });
}

const createSchema = z.object({
  phone: z.string().trim().min(6, "Please enter the guest's mobile number").max(20).regex(/^[+\d][\d\s-]*$/, "Please check the mobile number"),
  guestName: z.string().trim().max(80).optional().or(z.literal("")),
  checkIn: z.string().optional().or(z.literal("")),
  checkOut: z.string().optional().or(z.literal("")),
});

/** Staff create a form; the screen then opens WhatsApp with the link. */
export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const body = createSchema.parse(await request.json());
    const checkIn = isDateKey(body.checkIn) ? body.checkIn : null;
    const checkOut = isDateKey(body.checkOut) ? body.checkOut : null;
    if (checkIn && checkOut && diffDays(checkIn, checkOut) < 1) fail("The leaving date must be after the arrival date");
    const form = await prisma.guestForm.create({
      data: {
        hotelId: currentHotelId(),
        token: newFormToken(),
        phone: body.phone,
        guestName: body.guestName || null,
        checkInDate: checkIn ? dateFromKey(checkIn) : null,
        checkOutDate: checkIn && checkOut ? dateFromKey(checkOut) : null,
        sentById: user.id,
        sentByName: user.name,
        expiresAt: new Date(Date.now() + FORM_DAYS * 24 * 60 * 60 * 1000),
      },
      include: { documents: true },
    });
    await logActivity(user, "Guest form sent", `${body.guestName || "Guest"} (${body.phone})`);
    return NextResponse.json(serializeGuestForm(form), { status: 201 });
  });
}
