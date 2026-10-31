import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { deskStatus } from "@/lib/shift-api";

/** The owner's list of people waiting to take over a shift. */
export async function GET() {
  return withAdmin(async () => {
    const pending = await prisma.shiftTransfer.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" } });
    return NextResponse.json(pending);
  });
}

const requestSchema = z.object({
  shiftId: z.string().min(1, "Choose whose shift you are taking over"),
  startNote: z.string().trim().max(1000).optional().default(""),
});

/** Ask the person on shift to hand it over. Only one request per person is waiting at a time. */
export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = requestSchema.parse(await request.json());
    if (await prisma.shift.count({ where: { staffId: user.id, endedAt: null } })) fail("You are already on shift");
    const from = await prisma.shift.findFirst({ where: { id: body.shiftId, endedAt: null } });
    if (!from) fail("That shift has already ended. You can start your shift now.");
    if (from.staffId === user.id) fail("This is your own shift");
    if (!(await deskStatus(user.id)).full) fail("There is room at the front desk. You can start your shift now.");

    await prisma.shiftTransfer.updateMany({ where: { toStaffId: user.id, status: "pending" }, data: { status: "cancelled", respondedAt: new Date() } });
    const transfer = await prisma.shiftTransfer.create({
      data: { hotelId: currentHotelId(), fromShiftId: from.id, fromStaffName: from.staffName, toStaffId: user.id, toStaffName: user.name, startNote: body.startNote || null },
    });
    await logActivity(user, "Asked to take over a shift", `From ${from.staffName}`);
    return NextResponse.json(transfer);
  });
}
