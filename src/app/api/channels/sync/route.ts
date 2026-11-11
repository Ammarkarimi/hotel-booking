import { NextRequest, NextResponse } from "next/server";
import { withModule } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { syncChannels } from "@/lib/channel-sync";
import { openChannelIssues } from "@/lib/channel-bookings";

/** How many questions from booking sites are waiting. For the Dashboard. */
export async function GET() {
  return withModule("channel_manager", async () => NextResponse.json({ openIssues: await openChannelIssues() }));
}

/**
 * Brings the hotel up to date with its booking sites. The Dashboard, Calendar and Booking sites
 * screens call this when they open; "Check now" sends { force: true }.
 */
export async function POST(request: NextRequest) {
  return withModule("channel_manager", async () => {
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const ctx = await getBillingContext();
    return NextResponse.json(await syncChannels(ctx, { force: body.force === true }));
  });
}
