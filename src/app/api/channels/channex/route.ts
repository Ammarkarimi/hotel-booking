import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, withModule, withModuleAdmin } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getBillingContext } from "@/lib/settings";
import { siteOrigin } from "@/lib/payment-links";
import { ChannexError } from "@/lib/channex";
import { channexConfigured, channexStatus, connectChannex, disconnectChannex, getChannexLink, pushChannex } from "@/lib/channex-sync";

/** The full connection to booking sites through Channex: is it switched on, joined, and how is it going. */
export async function GET() {
  return withModule("channel_manager", async () => NextResponse.json(await channexStatus(await getBillingContext())));
}

function notSwitchedOn() {
  if (!channexConfigured()) fail("The full connection to booking sites is not switched on yet. Your software provider adds it.");
}

/** "Connect booking sites": makes the hotel's property in Channex and sends a year of free rooms and prices. */
export async function POST(request: NextRequest) {
  return withModuleAdmin("channel_manager", async () => {
    notSwitchedOn();
    if ((await prisma.room.count()) === 0) fail("Add your rooms first (Rooms → Add room), then connect.");
    const ctx = await getBillingContext();
    try {
      const result = await connectChannex(ctx, siteOrigin(request.headers));
      return NextResponse.json({ ...result, status: await channexStatus(ctx) });
    } catch (error) {
      if (error instanceof ChannexError) fail(`Could not connect: ${error.message} Press Connect again to carry on where it stopped.`, 502);
      throw error;
    }
  });
}

const markupSchema = z.object({
  markup: z.coerce.number({ invalid_type_error: "Please enter a number from 0 to 100." }).min(0, "The extra % cannot be below 0.").max(100, "The extra % can be at most 100."),
});

/** The % added to the prices sent to booking sites. The new prices are sent at once. */
export async function PATCH(request: NextRequest) {
  return withModuleAdmin("channel_manager", async () => {
    notSwitchedOn();
    const { markup } = markupSchema.parse(await request.json());
    const link = await getChannexLink();
    if (!link) fail("Connect booking sites first.", 404);
    await prisma.channexLink.update({ where: { id: link.id }, data: { markup: Math.round(markup * 100) / 100 } });
    const ctx = await getBillingContext();
    const push = await pushChannex(ctx, { force: true });
    return NextResponse.json({ ...push, status: await channexStatus(ctx) });
  });
}

/** Stops sending and reading. The property stays in Channex, so connecting again later keeps the sites. */
export async function DELETE() {
  return withModuleAdmin("channel_manager", async () => {
    await disconnectChannex();
    return NextResponse.json({ ok: true });
  });
}
