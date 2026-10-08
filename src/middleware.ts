import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session";

// Pages and APIs anyone can open without signing in (the guest booking website).
const publicPaths = ["/login", "/api/auth/login", "/book", "/api/public"];

function isPublic(pathname: string) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    if (pathname === "/login") {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      if (token && (await verifySessionToken(token))) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
