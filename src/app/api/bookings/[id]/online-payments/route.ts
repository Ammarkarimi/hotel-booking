import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { syncPaymentLinks } from "@/lib/payment-links";

type Params = { params: Promise<{ id: string }> };

/** Asks Razorpay whether the guest has paid through a link, and writes any payment down. */
export async function POST(_request: Request, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const ctx = await getBillingContext();
    const recorded = await syncPaymentLinks(id, ctx).catch(() => 0);
    return NextResponse.json({ recorded });
  });
}
