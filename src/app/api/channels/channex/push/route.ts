import { NextRequest, NextResponse } from "next/server";
import { fail, withModuleAdmin } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { siteOrigin } from "@/lib/payment-links";
import { channexConfigured, channexStatus, ensureChannexWebhook, getChannexLink, pullChannexBookings, pushChannex } from "@/lib/channex-sync";

/** "Send everything again": brings new bookings in, then sends the whole year of free rooms and prices. */
export async function POST(request: NextRequest) {
  return withModuleAdmin("channel_manager", async () => {
    if (!channexConfigured()) fail("The full connection to booking sites is not switched on yet.");
    if (!(await getChannexLink())) fail("Connect booking sites first.", 404);
    // Also a second chance for the instant booking messages, if they could not be set up when connecting.
    await ensureChannexWebhook(siteOrigin(request.headers));
    const ctx = await getBillingContext();
    const pull = await pullChannexBookings(ctx);
    const push = await pushChannex(ctx, { force: true });
    return NextResponse.json({ pulled: pull.pulled, pushed: push.pushed, error: pull.error ?? push.error, status: await channexStatus(ctx) });
  });
}
