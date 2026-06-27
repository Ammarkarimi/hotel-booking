import { NextResponse } from "next/server";
import { getSession } from "./auth";

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function withAuth<T>(
  handler: (user: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<T>
): Promise<T | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  return handler(session);
}
