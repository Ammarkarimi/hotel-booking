import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { recentHandovers, serializeShift, shiftsRequired } from "@/lib/shift-api";

/** The signed-in person's open shift (if any), the latest handover notes, and for the owner how many shift reports are unread. */
export async function GET() {
  return withAuth(async (user) => {
    const settings = await getSettings();
    const open = await prisma.shift.findFirst({ where: { staffId: user.id, endedAt: null }, orderBy: { startedAt: "desc" } });
    const admin = user.role === "admin";
    return NextResponse.json({
      required: await shiftsRequired(user),
      shift: open ? await serializeShift(open) : null,
      handovers: await recentHandovers(),
      ownerWhatsapp: settings.ownerWhatsapp,
      ...(admin && {
        unread: await prisma.shift.count({ where: { endedAt: { not: null }, ownerSeenAt: null } }),
        onDuty: await prisma.shift.count({ where: { endedAt: null } }),
      }),
    });
  });
}
