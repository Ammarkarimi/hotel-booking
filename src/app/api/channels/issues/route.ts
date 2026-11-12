import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withModule } from "@/lib/api";
import { logActivity } from "@/lib/activity";

/** Questions from booking sites: the open ones, and the last ones closed. */
export async function GET() {
  return withModule("channel_manager", async () => {
    const [open, closed] = await Promise.all([
      prisma.channelIssue.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.channelIssue.findMany({ where: { status: "closed" }, orderBy: { closedAt: "desc" }, take: 20 }),
    ]);
    return NextResponse.json({ open, closed });
  });
}

const schema = z.object({ id: z.string().min(1) });

/** Staff dealt with it: the question is closed and is not asked again. */
export async function PATCH(request: NextRequest) {
  return withModule("channel_manager", async (user) => {
    const { id } = schema.parse(await request.json());
    const issue = await prisma.channelIssue.findUnique({ where: { id } });
    if (!issue) fail("Not found", 404);
    if (issue.status === "open") {
      await prisma.channelIssue.update({ where: { id }, data: { status: "closed", closedAt: new Date(), closedBy: user.name } });
      await logActivity(user, "Booking site question closed", issue.title);
    }
    return NextResponse.json({ ok: true });
  });
}
