import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { parseGstSlabs } from "@/lib/pricing";

export async function GET() {
  return withAuth(async () => {
    const settings = await getSettings();
    const seasonalRates = await prisma.seasonalRate.findMany({ orderBy: { startDate: "asc" } });
    return NextResponse.json({ ...settings, gstSlabs: parseGstSlabs(settings.gstSlabs), seasonalRates });
  });
}

const text = z.string().trim().max(2000).optional().nullable();
const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM time");

const settingsSchema = z.object({
  hotelName: z.string().trim().min(1, "Hotel name is required").max(120),
  tagline: text,
  address: text,
  city: text,
  phone: text,
  email: z.string().trim().email("Email is not valid").optional().nullable().or(z.literal("")),
  gstin: text,
  currency: z.string().trim().length(3, "Use a 3-letter currency code like INR"),
  timezone: z.string().trim().min(1),
  taxMode: z.enum(["flat", "india_gst"]),
  taxRate: z.coerce.number().min(0).max(100),
  gstSlabs: z.array(z.object({ upTo: z.union([z.coerce.number().min(0), z.null()]), rate: z.coerce.number().min(0).max(100) })).min(1),
  extrasTaxRate: z.coerce.number().min(0).max(100),
  weekendSurcharge: z.coerce.number().min(-90).max(500),
  checkInTime: time,
  checkOutTime: time,
  invoicePrefix: z.string().trim().min(1).max(10),
  bookingTerms: text,
  websiteEnabled: z.boolean(),
  websiteAbout: text,
});

export async function PUT(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = settingsSchema.partial().parse(await request.json());
    if (body.timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: body.timezone });
      } catch {
        return NextResponse.json({ error: "Unknown timezone" }, { status: 400 });
      }
    }
    const { gstSlabs, ...rest } = body;
    const data = {
      ...rest,
      ...(rest.currency && { currency: rest.currency.toUpperCase() }),
      ...(rest.gstin !== undefined && { gstin: rest.gstin ? rest.gstin.toUpperCase() : null }),
      ...(gstSlabs && { gstSlabs: JSON.stringify(gstSlabs) }),
    };
    await getSettings();
    const settings = await prisma.hotelSettings.update({ where: { id: "default" }, data });
    await logActivity(user, "Settings changed", Object.keys(body).join(", "));
    return NextResponse.json({ ...settings, gstSlabs: parseGstSlabs(settings.gstSlabs) });
  });
}
