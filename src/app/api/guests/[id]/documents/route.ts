import { NextRequest, NextResponse } from "next/server";
import { currentHotelId, prisma } from "@/lib/db";
import { withAuth, fail } from "@/lib/api";
import { saveUploadedFile } from "@/lib/upload";
import { deleteStoredFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { DOCUMENT_TYPES, label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest) fail("Guest not found", 404);

    const formData = await request.formData();
    const file = formData.get("file");
    const type = String(formData.get("type") || "");
    if (!(file instanceof File) || file.size === 0) fail("Please choose a photo or PDF of the document");
    if (!(DOCUMENT_TYPES as readonly string[]).includes(type)) fail("Please choose the document type");
    if (file.size > MAX_BYTES) fail("The file is too large. Please use a file under 8 MB.");
    if (file.type && !ALLOWED_MIME.includes(file.type)) fail("Only photos (JPG, PNG) or PDF files can be uploaded");

    const saved = await saveUploadedFile(file, `hotels/${currentHotelId()}/guests/${id}`);
    const document = await prisma.guestDocument.create({
      data: { hotelId: currentHotelId(), guestId: id, type, fileName: saved.fileName, filePath: saved.filePath, mimeType: saved.mimeType },
    });
    await logActivity(user, "ID document uploaded", `${guest.firstName} ${guest.lastName}: ${label(type)}`.trim());
    return NextResponse.json(document, { status: 201 });
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const documents = await prisma.guestDocument.findMany({ where: { guestId: id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(documents);
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const docId = new URL(request.url).searchParams.get("docId");
    const doc = docId ? await prisma.guestDocument.findFirst({ where: { id: docId, guestId: id } }) : null;
    if (!doc) fail("Document not found", 404);
    await prisma.guestDocument.delete({ where: { id: doc.id } });
    await deleteStoredFile(doc.filePath).catch(() => undefined);
    await logActivity(user, "ID document removed", label(doc.type));
    return NextResponse.json({ success: true });
  });
}
