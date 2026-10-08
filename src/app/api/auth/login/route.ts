import { NextRequest, NextResponse } from "next/server";
import { login, createSession, COOKIE_NAME, SESSION_DURATION } from "@/lib/auth";
import { badRequest } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return badRequest("Please enter your email and password");
    }
    if (!rateLimit(`login:${clientIp(request.headers)}:${email}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }

    const user = await login(email, password);
    if (!user) {
      return NextResponse.json({ error: "Email or password is not correct" }, { status: 401 });
    }

    const token = await createSession(user);
    await logActivity(user, "Signed in");
    const response = NextResponse.json({ user });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not sign in. Please try again." }, { status: 500 });
  }
}
