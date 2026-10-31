import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { deskStatus, recentHandovers, serializeShift, shiftsRequired } from "@/lib/shift-api";

/** The signed-in person's open shift (if any), the latest handover notes, and for the owner how many shift reports are unread. */
export async function GET() {
  return withAuth(async (user) => {
    const settings = await getSettings();
    const open = await prisma.shift.findFirst({ where: { staffId: user.id, endedAt: null }, orderBy: { startedAt: "desc" } });
    const admin = user.role === "admin";
    // Someone asking to take over this person's shift, or this person's own request to take over someone else's.
    const incoming = open ? await prisma.shiftTransfer.findFirst({ where: { fromShiftId: open.id, status: "pending" }, orderBy: { createdAt: "asc" } }) : null;
    const myRequest = open
      ? null
      : await prisma.shiftTransfer.findFirst({ where: { toStaffId: user.id, createdAt: { gte: new Date(Date.now() - 3600 * 1000) } }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({
      required: await shiftsRequired(user),
      shift: open ? await serializeShift(open) : null,
      desk: open ? null : await deskStatus(user.id),
      incoming,
      myRequest,
      handovers: await recentHandovers(),
      ownerWhatsapp: settings.ownerWhatsapp,
      ...(admin && {
        unread: await prisma.shift.count({ where: { endedAt: { not: null }, ownerSeenAt: null } }),
        onDuty: await prisma.shift.count({ where: { endedAt: null } }),
        waitingHandovers: await prisma.shiftTransfer.count({ where: { status: "pending" } }),
      }),
    });
  });
}
