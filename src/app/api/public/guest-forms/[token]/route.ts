import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { diffDays, todayKey, toDateKey } from "@/lib/dates";
import { deleteStoredFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { noStore } from "@/lib/public";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { formStatus, guestFormSchema, missingDocuments } from "@/lib/guest-form";
import { assertFormOpen, withFormLink } from "@/lib/guest-forms-api";

type Params = { params: Promise<{ token: string }> };

/** What the guest's page needs: the hotel, any dates the desk suggested and the ID copies uploaded so far. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    return await withFormLink(token, async (form) => {
      const s = await getSettings();
      const status = formStatus(form);
      const documents =
        status === "sent"
          ? await prisma.guestDocument.findMany({ where: { guestFormId: form.id }, orderBy: { createdAt: "asc" }, select: { id: true, person: true, type: true, fileName: true } })
          : [];
      return noStore({
        hotel: { name: s.hotelName, phone: s.phone, address: s.address, city: s.city, checkInTime: s.checkInTime, checkOutTime: s.checkOutTime },
        status,
        today: todayKey(s.timezone),
        phone: form.phone,
        guestName: form.guestName,
        checkIn: form.checkInDate ? toDateKey(form.checkInDate) : null,
        checkOut: form.checkOutDate ? toDateKey(form.checkOutDate) : null,
        expiresAt: form.expiresAt,
        documents,
      });
    });
  } catch (error) {
    return handleError(error);
  }
}

/** The guest sends the form. After this it is locked, and the desk sees it. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!rateLimit(`guest-form:${clientIp(request.headers)}`, 20, 60 * 60 * 1000)) fail("Too many tries. Please wait a little or call the hotel.", 429);
    const { token } = await params;
    const raw = await request.json();
    return await withFormLink(token, async (form) => {
      // An expired or already-sent form says so, rather than asking the guest to fix their details.
      assertFormOpen(form);
      const details = guestFormSchema.parse(raw);
      const s = await getSettings();
      const today = todayKey(s.timezone);
      if (details.checkIn < today) fail("The arrival date cannot be in the past");
      if (diffDays(today, details.checkIn) > 366) fail("Please choose an arrival date within one year");

      const files = await prisma.guestDocument.findMany({ where: { guestFormId: form.id } });
      const missing = missingDocuments(details, files);
      if (missing.length) fail(missing[0]);

      // The last 4 Aadhaar digits are kept only for people who uploaded an Aadhaar.
      const hasAadhaar = (person: string) => files.some((f) => f.person === person && f.type === "aadhar");
      const saved = {
        ...details,
        pinCode: details.pinCode.replace(/\s/g, ""),
        aadhaarLast4: hasAadhaar("0") ? details.aadhaarLast4 : "",
        companions: details.companions.map((c, i) => ({ ...c, aadhaarLast4: hasAadhaar(String(i + 1)) ? c.aadhaarLast4 || "" : "" })),
      };

      // Copies for people no longer on the form (the guest lowered the number of adults) are deleted.
      const people = details.companions.length;
      const extra = files.filter((f) => Number(f.person) > people);
      const done = await prisma.$transaction(async (tx) => {
        const claimed = await tx.guestForm.updateMany({
          where: { id: form.id, status: "sent" },
          data: { status: "submitted", submittedAt: new Date(), details: JSON.stringify(saved) },
        });
        if (claimed.count !== 1) return false;
        if (extra.length) await tx.guestDocument.deleteMany({ where: { id: { in: extra.map((f) => f.id) } } });
        // From now on each copy says whose it is by name: empty for the guest, or the companion's name.
        await tx.guestDocument.updateMany({ where: { guestFormId: form.id, person: "0" }, data: { person: null } });
        for (const [i, c] of details.companions.entries()) {
          await tx.guestDocument.updateMany({ where: { guestFormId: form.id, person: String(i + 1) }, data: { person: c.name } });
        }
        return true;
      });
      if (!done) fail("Your details have already been sent to the hotel. Thank you!", 409);
      await Promise.all(extra.map((f) => deleteStoredFile(f.filePath).catch(() => undefined)));
      await logActivity({ id: null, name: "Guest (WhatsApp form)" }, "Guest form received", `${details.firstName} ${details.lastName}`.trim() + `, ${details.checkIn} to ${details.checkOut}`);
      return noStore({ ok: true });
    });
  } catch (error) {
    return handleError(error);
  }
}
