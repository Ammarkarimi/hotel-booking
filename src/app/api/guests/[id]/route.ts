import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, notFound } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        documents: true,
        bookings: {
          orderBy: { createdAt: "desc" },
          include: {
            room: true,
            payments: true,
            bill: true,
          },
        },
      },
    });

    if (!guest) return notFound("Guest not found");
    return NextResponse.json(guest);
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const body = await request.json();

    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest) return notFound("Guest not found");

    const updated = await prisma.guest.update({
      where: { id },
      data: {
        firstName: body.firstName ?? guest.firstName,
        lastName: body.lastName ?? guest.lastName,
        email: body.email ?? guest.email,
        phone: body.phone ?? guest.phone,
        nationality: body.nationality ?? guest.nationality,
        address: body.address ?? guest.address,
      },
      include: { documents: true },
    });

    return NextResponse.json(updated);
  });
}
