import { NextRequest } from "next/server";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { saveUploadedFile } from "@/lib/upload";
import { deleteStoredFile } from "@/lib/storage";
import { noStore } from "@/lib/public";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { FORM_ID_TYPES, MAX_FILES_PER_PERSON, MAX_FORM_FILES } from "@/lib/guest-form";
import { assertFormOpen, withFormLink } from "@/lib/guest-forms-api";

type Params = { params: Promise<{ token: string }> };

// Vercel refuses request bodies over 4.5 MB. The guest's phone shrinks photos before sending.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** The guest uploads one ID copy (a photo or PDF) for themselves or someone staying with them. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!rateLimit(`guest-form-upload:${clientIp(request.headers)}`, 60, 60 * 60 * 1000)) fail("Too many uploads. Please wait a little or call the hotel.", 429);
    const { token } = await params;
    return await withFormLink(token, async (form) => {
      assertFormOpen(form);
      const fd = await request.formData();
      const file = fd.get("file");
      const type = String(fd.get("type") || "");
      const person = String(fd.get("person") || "");
      if (!/^\d{1,2}$/.test(person) || Number(person) > 19) fail("Please choose whose ID this is");
      if (type === "aadhar") fail("Aadhaar copies are not saved. The front desk checks the card at check-in instead.");
      if (!(FORM_ID_TYPES as readonly string[]).includes(type)) fail("Please choose the type of ID");
      if (!(file instanceof File) || file.size === 0) fail("Please choose a photo or PDF of the ID");
      if (file.size > MAX_BYTES) fail("The file is too large. Please use a photo, or a PDF under 4 MB.");
      if (file.type && !ALLOWED_MIME.includes(file.type)) fail("Only photos (JPG, PNG) or PDF files can be uploaded");

      const existing = await prisma.guestDocument.findMany({ where: { guestFormId: form.id }, select: { person: true } });
      if (existing.length >= MAX_FORM_FILES) fail("That is the most files one form can take. Please remove one first.");
      if (existing.filter((d) => d.person === person).length >= MAX_FILES_PER_PERSON) fail(`Up to ${MAX_FILES_PER_PERSON} files per person. Please remove one first.`);

      const saved = await saveUploadedFile(file, `hotels/${currentHotelId()}/guest-forms/${form.id}`);
      const doc = await prisma.guestDocument.create({
        data: { hotelId: currentHotelId(), guestFormId: form.id, person, type, fileName: saved.fileName, filePath: saved.filePath, mimeType: saved.mimeType },
        select: { id: true, person: true, type: true, fileName: true },
      });
      return noStore(doc, { status: 201 });
    });
  } catch (error) {
    return handleError(error);
  }
}

/** The guest removes a copy they uploaded by mistake (only before sending the form). */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const docId = new URL(request.url).searchParams.get("docId") || "";
    return await withFormLink(token, async (form) => {
      assertFormOpen(form);
      const doc = await prisma.guestDocument.findFirst({ where: { id: docId, guestFormId: form.id } });
      if (!doc) fail("File not found", 404);
      await prisma.guestDocument.delete({ where: { id: doc.id } });
      await deleteStoredFile(doc.filePath).catch(() => undefined);
      return noStore({ ok: true });
    });
  } catch (error) {
    return handleError(error);
  }
}
