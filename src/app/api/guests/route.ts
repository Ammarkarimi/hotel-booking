import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { guestData, guestSchema } from "@/lib/guests";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const limit = Math.min(500, Number(searchParams.get("limit")) || 200);

    let where: Prisma.GuestWhereInput | undefined;
    if (search) {
      const words = search.split(/\s+/).filter(Boolean);
      where = {
        AND: words.map((w) => ({
          OR: [
            { firstName: { contains: w, mode: "insensitive" } },
            { lastName: { contains: w, mode: "insensitive" } },
            { phone: { contains: w } },
            { email: { contains: w, mode: "insensitive" } },
            { idNumber: { contains: w, mode: "insensitive" } },
            { company: { contains: w, mode: "insensitive" } },
          ],
        })),
      };
    }

    const guests = await prisma.guest.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        documents: true,
        _count: { select: { bookings: true } },
        bookings: { orderBy: { checkInDate: "desc" }, take: 1, include: { room: true } },
      },
    });
    return NextResponse.json(guests);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = guestSchema.parse(await request.json());
    const data = guestData(body);
    const guest = await prisma.guest.create({
      data: { hotelId: currentHotelId(), ...data, firstName: body.firstName, phone: body.phone },
      include: { documents: true },
    });
    await logActivity(user, "Guest added", `${guest.firstName} ${guest.lastName}`.trim());
    return NextResponse.json(guest, { status: 201 });
  });
}
