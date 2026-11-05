import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  name: z.string().trim().min(1, "Please type the name of the hall").max(60),
  capacity: z.coerce.number().int().min(0).max(20000).default(0),
  rent: z.coerce.number().min(0, "The rent cannot be less than 0").max(10_000_000).default(0),
  notes: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().default(true),
});

const duplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Owner: add a hall (or lawn, terrace, meeting room). */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const b = schema.parse(await request.json());
    try {
      const hall = await prisma.banquetHall.create({ data: { hotelId: currentHotelId(), ...b, notes: b.notes || null } });
      await logActivity(user, "Hall added", `${hall.name}, ${hall.capacity} guests, rent ${hall.rent}`);
      return NextResponse.json(hall, { status: 201 });
    } catch (e) {
      if (duplicate(e)) fail("There is already a hall with this name");
      throw e;
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withAdmin(async (user) => {
    const { id, ...rest } = await request.json();
    const b = schema.parse(rest);
    const old = await prisma.banquetHall.findUnique({ where: { id: String(id) } });
    if (!old) fail("Hall not found", 404);
    try {
      const hall = await prisma.banquetHall.update({ where: { id: old.id }, data: { ...b, notes: b.notes || null } });
      await logActivity(user, "Hall changed", `${hall.name}${hall.active ? "" : " (switched off)"}`);
      return NextResponse.json(hall);
    } catch (e) {
      if (duplicate(e)) fail("There is already a hall with this name");
      throw e;
    }
  });
}

/** A hall that was ever booked is switched off instead, so old functions keep it. */
export async function DELETE(request: NextRequest) {
  return withAdmin(async (user) => {
    const id = new URL(request.url).searchParams.get("id") || "";
    const hall = await prisma.banquetHall.findUnique({ where: { id }, include: { _count: { select: { banquets: true } } } });
    if (!hall) fail("Hall not found", 404);
    if (hall._count.banquets > 0) fail("This hall has functions booked in it. Switch it off instead of deleting it.");
    await prisma.banquetHall.delete({ where: { id } });
    await logActivity(user, "Hall deleted", hall.name);
    return NextResponse.json({ success: true });
  });
}
