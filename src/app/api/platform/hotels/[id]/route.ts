import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { withPlatform } from "@/lib/platform";
import { chooseSlug, deleteHotelData, hotelFields, platformHotelDetail } from "@/lib/platform-hotels";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    return NextResponse.json(await platformHotelDetail(id));
  });
}

const updateSchema = z.object({ ...hotelFields, status: z.enum(["active", "suspended"]) }).partial();

export async function PATCH(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const hotel = await rawPrisma.hotel.findUnique({ where: { id } });
    if (!hotel) fail("Hotel not found", 404);

    const slug = body.slug !== undefined && body.slug !== hotel.slug ? await chooseSlug(body.slug, hotel.name, id) : undefined;
    const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    await rawPrisma.hotel.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(slug && { slug }),
        ...(body.status && { status: body.status }),
        ...(body.monthlyFee !== undefined && { monthlyFee: body.monthlyFee }),
        ...(body.billingStart && { billingStart: body.billingStart }),
        city: text(body.city),
        contactName: text(body.contactName),
        contactPhone: text(body.contactPhone),
        contactEmail: text(body.contactEmail),
        notes: text(body.notes),
      },
    });
    // Keep the name on the hotel's invoices and website in step.
    if (body.name) await rawPrisma.hotelSettings.updateMany({ where: { hotelId: id }, data: { hotelName: body.name } });
    return NextResponse.json(await platformHotelDetail(id));
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const { confirmName } = z.object({ confirmName: z.string() }).parse(await request.json());
    const hotel = await rawPrisma.hotel.findUnique({ where: { id } });
    if (!hotel) fail("Hotel not found", 404);
    if (confirmName.trim().toLowerCase() !== hotel.name.trim().toLowerCase()) {
      fail("Type the hotel's name exactly to confirm deleting it");
    }
    await deleteHotelData(id);
    return NextResponse.json({ success: true });
  });
}
