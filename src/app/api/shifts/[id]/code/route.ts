import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { shiftCode } from "@/lib/shifts";
import { serializeShift } from "@/lib/shift-api";

type Params = { params: Promise<{ id: string }> };

/** A new code to type for ending one's own shift, with the shift's summary so far. */
export async function POST(_request: Request, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const shift = await prisma.shift.findFirst({ where: { id, staffId: user.id } });
    if (!shift) fail("Shift not found", 404);
    if (shift.endedAt) fail("This shift has already ended");
    const code = shiftCode();
    const updated = await prisma.shift.update({ where: { id }, data: { endCode: code } });
    return NextResponse.json({ code, shift: await serializeShift(updated) });
  });
}
