import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { diffDays, todayKey, toDateKey } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { noStore } from "@/lib/public";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cleanDetails, formStatus, guestFormSchema } from "@/lib/guest-form";
import { assertFormOpen, withFormLink } from "@/lib/guest-forms-api";

type Params = { params: Promise<{ token: string }> };

/** What the guest's page needs: the hotel and any dates the desk suggested. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    return await withFormLink(token, async (form) => {
      const s = await getSettings();
      return noStore({
        hotel: { name: s.hotelName, phone: s.phone, address: s.address, city: s.city, checkInTime: s.checkInTime, checkOutTime: s.checkOutTime },
        status: formStatus(form),
        today: todayKey(s.timezone),
        phone: form.phone,
        guestName: form.guestName,
        checkIn: form.checkInDate ? toDateKey(form.checkInDate) : null,
        checkOut: form.checkOutDate ? toDateKey(form.checkOutDate) : null,
        expiresAt: form.expiresAt,
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

      // A foreign guest shows a passport, not an Aadhaar.
      const saved = cleanDetails(details);

      const claimed = await prisma.guestForm.updateMany({
        where: { id: form.id, status: "sent" },
        data: { status: "submitted", submittedAt: new Date(), details: JSON.stringify(saved) },
      });
      if (claimed.count !== 1) fail("Your details have already been sent to the hotel. Thank you!", 409);
      await logActivity({ id: null, name: "Guest (WhatsApp form)" }, "Guest form received", `${details.firstName} ${details.lastName}`.trim() + `, ${details.checkIn} to ${details.checkOut}`);
      return noStore({ ok: true });
    });
  } catch (error) {
    return handleError(error);
  }
}
