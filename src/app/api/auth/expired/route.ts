import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { verifySessionToken } from "@/lib/session";
import { rawPrisma } from "@/lib/db";

/**
 * The sign-in cookie is still valid but the person may no longer use the software (their
 * account was switched off or removed, or the hotel was paused). Clear the cookie and send
 * them to the sign-in page with the reason, so they are not bounced between pages.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  let reason = "ended";
  if (session) {
    const staff = await rawPrisma.staff.findUnique({ where: { id: session.id }, select: { active: true, hotel: { select: { status: true } } } });
    if (staff?.active && staff.hotel.status !== "active") reason = "paused";
  }
  const response = NextResponse.redirect(new URL(`/login?reason=${reason}`, request.url));
  response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}
