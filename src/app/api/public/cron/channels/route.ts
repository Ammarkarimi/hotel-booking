import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncAllHotels } from "@/lib/channel-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function allowed(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(request.url).searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The timer: brings every hotel up to date with its booking sites. Call it every 10 to 15 minutes
 * with "Authorization: Bearer <CRON_SECRET>" (Vercel Cron does this by itself) or ?key=<CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  if (!allowed(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  return NextResponse.json(await syncAllHotels());
}
