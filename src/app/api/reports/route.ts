import { NextRequest, NextResponse } from "next/server";
import { withAdmin, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { addDays, diffDays, isDateKey } from "@/lib/dates";
import { defaultGroupBy, type GroupBy } from "@/lib/periods";
import { buildReport } from "@/lib/reports";

const GROUPS: GroupBy[] = ["day", "week", "month"];

export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const ctx = await getBillingContext();
    const to = isDateKey(searchParams.get("to")) ? searchParams.get("to")! : ctx.today;
    const from = isDateKey(searchParams.get("from")) ? searchParams.get("from")! : addDays(to, -29);
    if (to < from) fail("The end date must be after the start date");
    if (diffDays(from, to) > 366) fail("Please choose a period of one year or less");
    const asked = searchParams.get("groupBy") as GroupBy | null;
    const groupBy = asked && GROUPS.includes(asked) ? asked : defaultGroupBy(from, to);
    return NextResponse.json(await buildReport(ctx, from, to, groupBy));
  });
}
