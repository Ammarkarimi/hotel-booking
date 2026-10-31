import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, isAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { closeShift, serializeShift, startShift } from "@/lib/shift-api";

type Params = { params: Promise<{ id: string }> };

const answerSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
  handoverNote: z.string().trim().max(2000).optional().default(""),
});

/**
 * The person on shift accepts (with their handover note) or declines; the owner can do either for someone who has
 * already left; the person who asked can cancel. Accepting ends the shift and starts the new person's at the same moment.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = answerSchema.parse(await request.json());
    const transfer = await prisma.shiftTransfer.findUnique({ where: { id }, include: { fromShift: true } });
    if (!transfer) fail("Request not found", 404);
    if (transfer.status !== "pending") fail(transfer.status === "cancelled" ? "This request was cancelled" : "This request has already been answered");
    const now = new Date();

    if (body.action === "cancel") {
      if (transfer.toStaffId !== user.id) fail("Only the person who asked can cancel this request", 403);
      await prisma.shiftTransfer.update({ where: { id }, data: { status: "cancelled", respondedAt: now, respondedBy: user.name } });
      return NextResponse.json({ ok: true });
    }

    const own = transfer.fromShift.staffId === user.id;
    if (!own && !isAdmin(user)) fail("Only the person on this shift or the owner can answer", 403);
    if (transfer.fromShift.endedAt) fail("That shift has already ended");

    if (body.action === "decline") {
      await prisma.shiftTransfer.update({ where: { id }, data: { status: "declined", respondedAt: now, respondedBy: user.name } });
      await logActivity(user, "Shift handover declined", `${transfer.toStaffName} asked to take over ${transfer.fromStaffName}'s shift`);
      return NextResponse.json({ ok: true });
    }

    if (own && body.handoverNote.length < 5) fail("Please write a handover note for the next person (at least a few words)");
    const ended = await closeShift(transfer.fromShift, {
      reason: "transferred",
      handoverNote: own ? body.handoverNote : undefined,
      by: own ? undefined : user.name,
      handedOverTo: transfer.toStaffName,
      keepTransferId: id,
      at: now,
    });
    await prisma.shiftTransfer.update({ where: { id }, data: { status: "accepted", respondedAt: now, respondedBy: user.name } });
    await startShift({ id: transfer.toStaffId, name: transfer.toStaffName }, transfer.startNote, now);
    await logActivity(user, "Shift handed over", `${transfer.fromStaffName} to ${transfer.toStaffName}${own ? "" : ` (approved by ${user.name})`}`);
    return NextResponse.json(await serializeShift(ended));
  });
}
