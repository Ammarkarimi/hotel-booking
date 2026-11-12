import { NextResponse } from "next/server";
import { fail, withModuleAdmin } from "@/lib/api";
import { channelScreenUrl, ChannexError } from "@/lib/channex";
import { channexConfigured, getChannexLink } from "@/lib/channex-sync";

/**
 * The address of Channex's screen where the owner joins each booking site and matches its rooms.
 * The address signs in by itself, works once and only for 15 minutes, so it is made fresh each time.
 */
export async function POST() {
  return withModuleAdmin("channel_manager", async (user) => {
    if (!channexConfigured()) fail("The full connection to booking sites is not switched on yet.");
    const link = await getChannexLink();
    if (!link) fail("Connect booking sites first.", 404);
    try {
      return NextResponse.json({ url: await channelScreenUrl(link.propertyId, user.name || user.email) });
    } catch (error) {
      if (error instanceof ChannexError) fail(`Could not open the booking sites screen. ${error.message}`, 502);
      throw error;
    }
  });
}
