import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { deleteStoredFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { FORM_DAYS, formStatus } from "@/lib/guest-form";
import { serializeGuestForm } from "@/lib/guest-forms-api";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const form = await prisma.guestForm.findUnique({ where: { id }, include: { documents: { orderBy: { createdAt: "asc" } } } });
  if (!form) fail("Guest form not found", 404);
  return form;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    return NextResponse.json(serializeGuestForm(await load(id)));
  });
}

const actionSchema = z.object({ action: z.enum(["cancel", "resend"]) });

/**
 * resend: the link works for another week (the screen opens WhatsApp again).
 * cancel: the form is closed; anything the guest uploaded is deleted, because no booking will keep it.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const { action } = actionSchema.parse(await request.json());
    const form = await load(id);
    const name = form.guestName || form.phone;

    if (action === "resend") {
      if (form.status !== "sent") fail("This form has already been filled in or closed.", 409);
      const updated = await prisma.guestForm.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() + FORM_DAYS * 24 * 60 * 60 * 1000) },
        include: { documents: { orderBy: { createdAt: "asc" } } },
      });
      await logActivity(user, "Guest form sent again", name);
      return NextResponse.json(serializeGuestForm(updated));
    }

    const status = formStatus(form);
    if (status === "booked") fail("A booking has already been made from this form.", 409);
    if (status === "cancelled") return NextResponse.json(serializeGuestForm(form));
    const closed = await prisma.guestForm.updateMany({
      where: { id, status: { in: ["sent", "submitted"] } },
      data: { status: "cancelled", closedAt: new Date(), closedBy: user.name },
    });
    if (closed.count !== 1) fail("This form has just been used for a booking. Please refresh.", 409);
    await prisma.guestDocument.deleteMany({ where: { guestFormId: id, guestId: null } });
    await Promise.all(form.documents.filter((d) => !d.guestId).map((d) => deleteStoredFile(d.filePath).catch(() => undefined)));
    await logActivity(user, "Guest form closed", name);
    return NextResponse.json(serializeGuestForm(await load(id)));
  });
}
