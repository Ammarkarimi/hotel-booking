import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readStoredFile } from "@/lib/storage";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "File path required" }, { status: 400 });
  }

  const sanitized = filePath.replace(/\.\./g, "").replace(/\\/g, "/");

  try {
    const { buffer, contentType } = await readStoredFile(sanitized);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(sanitized)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
