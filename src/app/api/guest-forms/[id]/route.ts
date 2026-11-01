import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { deleteStoredFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { FORM_DAYS, cleanDetails, formStatus, staffFormSchema } from "@/lib/guest-form";
import { parseDetails, serializeGuestForm } from "@/lib/guest-forms-api";

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

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("resend") }),
  z.object({ action: z.literal("edit"), details: staffFormSchema }),
]);

/**
 * resend: the link works for another week (the screen opens WhatsApp again).
 * cancel: the form is closed; anything the guest uploaded is deleted, because no booking will keep it.
 * edit: the front desk corrects what the guest filled in, before choosing the room.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const body = actionSchema.parse(await request.json());
    const { action } = body;
    const form = await load(id);
    const name = form.guestName || form.phone;

    if (body.action === "edit") {
      const status = formStatus(form);
      if (status === "booked") fail("A booking has already been made from this form. Change the details on the booking or the guest's profile.", 409);
      if (status !== "submitted") fail("Only a form the guest has filled in can be changed.", 409);
      const before = parseDetails(form.details);
      const after = { ...cleanDetails(body.details), consent: true as const };
      const oldPeople = before?.companions ?? [];
      // ID copies say whose they are by name: they follow a renamed adult, and go with an adult who was taken off.
      const copiesOf = (who: string) => form.documents.filter((d) => !d.guestId && d.person === who).map((d) => d.id);
      const renames = oldPeople.slice(0, after.companions.length).map((c, i) => ({ ids: copiesOf(c.name), name: after.companions[i].name })).filter((r) => r.ids.length);
      const removed = oldPeople.slice(after.companions.length).flatMap((c) => copiesOf(c.name));
      const saved = await prisma.$transaction(async (tx) => {
        const claimed = await tx.guestForm.updateMany({ where: { id, status: "submitted" }, data: { details: JSON.stringify(after) } });
        if (claimed.count !== 1) return false;
        for (const r of renames) await tx.guestDocument.updateMany({ where: { id: { in: r.ids } }, data: { person: r.name } });
        if (removed.length) await tx.guestDocument.deleteMany({ where: { id: { in: removed } } });
        return true;
      });
      if (!saved) fail("This form has just been used for a booking. Please refresh.", 409);
      await Promise.all(form.documents.filter((d) => removed.includes(d.id)).map((d) => deleteStoredFile(d.filePath).catch(() => undefined)));
      const changed = before ? (Object.keys(after) as (keyof typeof after)[]).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])) : [];
      await logActivity(user, "Guest form details changed", `${after.firstName} ${after.lastName}`.trim() + (changed.length ? `: ${changed.join(", ")}` : ""));
      return NextResponse.json(serializeGuestForm(await load(id)));
    }

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
