import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  housekeeping: z.enum(["clean", "dirty", "cleaning"]),
  houseKeeperName: z.string().trim().optional().nullable(),
  housekeepingNotes: z.string().trim().optional().nullable(),
});

/** Any staff member can update cleaning status. */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) fail("Room not found", 404);

    const updated = await prisma.room.update({
      where: { id },
      data: {
        housekeeping: body.housekeeping,
        houseKeeperName: body.housekeeping === "clean" ? null : body.houseKeeperName ?? room.houseKeeperName,
        housekeepingNotes: body.housekeeping === "clean" ? null : body.housekeepingNotes ?? room.housekeepingNotes,
      },
    });
    await logActivity(
      user,
      "Housekeeping",
      `Room ${room.roomNumber}: ${label(body.housekeeping)}${updated.houseKeeperName ? ` (${updated.houseKeeperName})` : ""}`
    );
    return NextResponse.json(updated);
  });
}
