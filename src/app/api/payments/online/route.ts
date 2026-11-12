import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { syncRecentLinks } from "@/lib/payment-links";

/**
 * Writes down payments guests made through the past week's Razorpay links, for example a guest
 * who paid and closed the page. The Dashboard and Payments screens call this when they open.
 */
export async function POST() {
  return withAuth(async () => {
    const ctx = await getBillingContext();
    const recorded = await syncRecentLinks(ctx).catch(() => 0);
    return NextResponse.json({ recorded });
  });
}
