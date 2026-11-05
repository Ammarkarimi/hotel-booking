import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAdmin, withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

function defaults(s: Awaited<ReturnType<typeof getSettings>>) {
  return { foodGst: s.banquetFoodGst, hallGst: s.banquetHallGst, itemGst: s.banquetItemGst, prefix: s.banquetPrefix, terms: s.banquetTerms };
}

/** Halls, menus and the default GST, for the function form and the setup screen. */
export async function GET() {
  return withAuth(async () => {
    const [halls, menus, settings] = await Promise.all([
      prisma.banquetHall.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
      prisma.banquetMenu.findMany({ orderBy: [{ active: "desc" }, { pricePerPlate: "asc" }] }),
      getSettings(),
    ]);
    return NextResponse.json({ halls, menus, defaults: defaults(settings) });
  });
}

const gst = z.coerce.number().min(0).max(40, "Please check the GST %");
const schema = z.object({
  foodGst: gst,
  hallGst: gst,
  itemGst: gst,
  prefix: z
    .string()
    .trim()
    .min(1, "Please type an invoice prefix, like BQ")
    .max(10)
    .regex(/^[A-Za-z0-9/-]+$/, "Use only letters, numbers, / and - in the invoice prefix"),
  terms: z.string().trim().max(3000).nullable().optional(),
});

/** Owner: the GST charged by default on new functions, the invoice prefix and the terms printed on quotations. */
export async function PUT(request: NextRequest) {
  return withAdmin(async (user) => {
    const b = schema.parse(await request.json());
    const s = await getSettings();
    const prefix = b.prefix.toUpperCase();
    const updated = await prisma.hotelSettings.update({
      where: { id: s.id },
      data: { banquetFoodGst: b.foodGst, banquetHallGst: b.hallGst, banquetItemGst: b.itemGst, banquetPrefix: prefix, banquetTerms: b.terms || null },
    });
    await logActivity(user, "Banquet settings changed", `Food GST ${b.foodGst}%, hall ${b.hallGst}%, services ${b.itemGst}%, invoices ${prefix}-…`);
    return NextResponse.json(defaults(updated));
  });
}
