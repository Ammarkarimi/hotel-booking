import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, isAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { codeMatches, durationLabel, shiftSummary } from "@/lib/shifts";
import { serializeShift } from "@/lib/shift-api";

type Params = { params: Promise<{ id: string }> };

const endSchema = z.object({
  handoverNote: z.string().trim().max(2000).optional().default(""),
  code: z.string().optional().default(""),
});

/**
 * End a shift. The staff member must leave a handover note and type the code shown on screen.
 * The owner can close a shift that someone forgot to end, without the code.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = endSchema.parse(await request.json());
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) fail("Shift not found", 404);
    if (shift.endedAt) fail("This shift has already ended");
    const own = shift.staffId === user.id;
    if (!own && !isAdmin(user)) fail("You can only end your own shift", 403);

    if (own) {
      if (body.handoverNote.length < 5) fail("Please write a handover note for the next person (at least a few words)");
      if (!codeMatches(shift.endCode, body.code)) fail("The code does not match. Please type the code shown on the screen.");
    }
    const endedAt = new Date();
    const summary = await shiftSummary({ id: shift.staffId, name: shift.staffName }, shift.startedAt, endedAt);
    const closedByOwner = !own;
    const updated = await prisma.shift.update({
      where: { id },
      data: {
        endedAt,
        endCode: null,
        summary: JSON.stringify(summary),
        handoverNote: body.handoverNote || (closedByOwner ? null : shift.handoverNote),
        endedBy: closedByOwner ? user.name : null,
        // The owner closing a shift has already seen it.
        ownerSeenAt: closedByOwner ? endedAt : null,
      },
    });
    await logActivity(
      user,
      closedByOwner ? "Shift closed by owner" : "Shift ended",
      `${shift.staffName}, ${durationLabel(endedAt.getTime() - shift.startedAt.getTime())}: ${summary.checkIns} check-ins, ${summary.checkOuts} check-outs`
    );
    return NextResponse.json(await serializeShift(updated));
  });
}
