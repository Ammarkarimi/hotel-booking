import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, badRequest } from "@/lib/api";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const guests = await prisma.guest.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        documents: true,
        bookings: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { room: true },
        },
      },
    });

    return NextResponse.json(guests);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await request.json();
    const { firstName, lastName, email, phone, nationality, address } = body;

    if (!firstName || !lastName || !phone) {
      return badRequest("First name, last name, and phone are required");
    }

    const guest = await prisma.guest.create({
      data: {
        firstName,
        lastName,
        email: email || null,
        phone,
        nationality: nationality || "Indian",
        address: address || null,
      },
      include: { documents: true },
    });

    return NextResponse.json(guest);
  });
}
