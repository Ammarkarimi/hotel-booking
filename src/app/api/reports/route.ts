import { NextRequest, NextResponse } from "next/server";
import { withAdmin, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { addDays, diffDays, isDateKey } from "@/lib/dates";
import { buildReport } from "@/lib/reports";

export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const ctx = await getBillingContext();
    const to = isDateKey(searchParams.get("to")) ? searchParams.get("to")! : ctx.today;
    const from = isDateKey(searchParams.get("from")) ? searchParams.get("from")! : addDays(to, -29);
    if (to < from) fail("The end date must be after the start date");
    if (diffDays(from, to) > 366) fail("Please choose a period of one year or less");
    return NextResponse.json(await buildReport(ctx, from, to));
  });
}
