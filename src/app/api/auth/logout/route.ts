import { NextResponse } from "next/server";
import { COOKIE_NAME, getSession } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}

export async function GET() {
  return NextResponse.json({ user: await getSession() });
}
