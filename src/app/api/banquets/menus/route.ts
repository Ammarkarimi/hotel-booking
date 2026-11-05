import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { FOOD_TYPES } from "@/lib/banquet-bill";

const schema = z.object({
  name: z.string().trim().min(1, "Please type the name of the menu").max(80),
  foodType: z.enum(FOOD_TYPES).default("veg"),
  pricePerPlate: z.coerce.number().min(0, "The price cannot be less than 0").max(100000),
  items: z.string().trim().max(3000).nullable().optional(),
  active: z.boolean().default(true),
});

const duplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Owner: a menu (package) with its price per plate. Choosing it on a function copies the price and dishes. */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const b = schema.parse(await request.json());
    try {
      const menu = await prisma.banquetMenu.create({ data: { hotelId: currentHotelId(), ...b, items: b.items || null } });
      await logActivity(user, "Banquet menu added", `${menu.name}, ${menu.pricePerPlate} a plate`);
      return NextResponse.json(menu, { status: 201 });
    } catch (e) {
      if (duplicate(e)) fail("There is already a menu with this name");
      throw e;
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withAdmin(async (user) => {
    const { id, ...rest } = await request.json();
    const b = schema.parse(rest);
    const old = await prisma.banquetMenu.findUnique({ where: { id: String(id) } });
    if (!old) fail("Menu not found", 404);
    try {
      const menu = await prisma.banquetMenu.update({ where: { id: old.id }, data: { ...b, items: b.items || null } });
      await logActivity(user, "Banquet menu changed", `${menu.name}, ${menu.pricePerPlate} a plate${menu.active ? "" : " (switched off)"}`);
      return NextResponse.json(menu);
    } catch (e) {
      if (duplicate(e)) fail("There is already a menu with this name");
      throw e;
    }
  });
}

/** Functions keep their own copy of the menu, so a menu can always be deleted. */
export async function DELETE(request: NextRequest) {
  return withAdmin(async (user) => {
    const id = new URL(request.url).searchParams.get("id") || "";
    const menu = await prisma.banquetMenu.findUnique({ where: { id } });
    if (!menu) fail("Menu not found", 404);
    await prisma.banquetMenu.delete({ where: { id } });
    await logActivity(user, "Banquet menu deleted", menu.name);
    return NextResponse.json({ success: true });
  });
}
