import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, fail, isAdmin } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { bookingLabel, loadBooking, serializeBooking } from "@/lib/bookings";
import { logActivity } from "@/lib/activity";
import { round2 } from "@/lib/pricing";
import { CHARGE_CATEGORIES, label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const chargeSchema = z.object({
  category: z.enum(CHARGE_CATEGORIES).default("other"),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().positive("Quantity must be more than zero").default(1),
  unitPrice: z.coerce.number().positive("Price must be more than zero"),
});

function assertOpen(status: string) {
  if (status === "checked_out") fail("This guest has already checked out and the bill is final");
  if (status === "cancelled" || status === "no_show") fail("This booking is cancelled");
}

export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = chargeSchema.parse(await request.json());
    const booking = await loadBooking(id);
    assertOpen(booking.status);

    const description = body.description || label(body.category);
    await prisma.charge.create({
      data: {
        bookingId: id,
        category: body.category,
        description,
        quantity: body.quantity,
        unitPrice: body.unitPrice,
        amount: round2(body.quantity * body.unitPrice),
      },
    });
    await logActivity(user, "Extra charge added", `${bookingLabel(booking)}: ${description} ${round2(body.quantity * body.unitPrice)}`);
    const ctx = await getBillingContext();
    return NextResponse.json(serializeBooking(await loadBooking(id), ctx), { status: 201 });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const chargeId = new URL(request.url).searchParams.get("chargeId");
    if (!chargeId) fail("Charge not specified");
    const booking = await loadBooking(id);
    assertOpen(booking.status);
    const charge = booking.charges.find((c) => c.id === chargeId);
    if (!charge) fail("Charge not found", 404);
    // Front-desk staff may only remove charges added today, to fix mistakes.
    const sameDay = new Date(charge.createdAt).toDateString() === new Date().toDateString();
    if (!isAdmin(user) && !sameDay) fail("Only the owner / manager can remove older charges", 403);

    await prisma.charge.delete({ where: { id: chargeId } });
    await logActivity(user, "Extra charge removed", `${bookingLabel(booking)}: ${charge.description} ${charge.amount}`);
    const ctx = await getBillingContext();
    return NextResponse.json(serializeBooking(await loadBooking(id), ctx));
  });
}
