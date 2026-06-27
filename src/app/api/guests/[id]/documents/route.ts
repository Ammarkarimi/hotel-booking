import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, badRequest, notFound } from "@/lib/api";
import { saveUploadedFile } from "@/lib/upload";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest) return notFound("Guest not found");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string;

    if (!file || !type) {
      return badRequest("File and document type are required");
    }

    const allowedTypes = ["aadhar", "pan", "passport"];
    if (!allowedTypes.includes(type)) {
      return badRequest("Invalid document type");
    }

    const saved = await saveUploadedFile(file, `guests/${id}`);

    const document = await prisma.guestDocument.create({
      data: {
        guestId: id,
        type,
        fileName: saved.fileName,
        filePath: saved.filePath,
        mimeType: saved.mimeType,
      },
    });

    return NextResponse.json(document);
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const documents = await prisma.guestDocument.findMany({
      where: { guestId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(documents);
  });
}
