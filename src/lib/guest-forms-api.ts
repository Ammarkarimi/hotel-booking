// Server side of the WhatsApp guest form: finding a form by its link, and the shape staff screens get.
import { randomBytes } from "crypto";
import type { GuestDocument, GuestForm, Hotel } from "@prisma/client";
import { rawPrisma, runForHotel } from "./db";
import { fail } from "./api";
import { toDateKey } from "./dates";
import { formStatus, type GuestFormDetails } from "./guest-form";

/** The secret part of the link: long enough that nobody can guess another guest's form. */
export function newFormToken() {
  return randomBytes(18).toString("base64url");
}

export function parseDetails(raw: string | null | undefined): GuestFormDetails | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestFormDetails;
  } catch {
    return null;
  }
}

export function serializeGuestForm(form: GuestForm & { documents?: GuestDocument[] }) {
  return {
    id: form.id,
    token: form.token,
    phone: form.phone,
    guestName: form.guestName,
    checkIn: form.checkInDate ? toDateKey(form.checkInDate) : null,
    checkOut: form.checkOutDate ? toDateKey(form.checkOutDate) : null,
    status: formStatus(form),
    details: parseDetails(form.details),
    sentByName: form.sentByName,
    createdAt: form.createdAt,
    expiresAt: form.expiresAt,
    submittedAt: form.submittedAt,
    bookingId: form.bookingId,
    closedAt: form.closedAt,
    closedBy: form.closedBy,
    documents: (form.documents ?? []).map((d) => ({
      id: d.id,
      type: d.type,
      person: d.person,
      fileName: d.fileName,
      filePath: d.filePath,
      mimeType: d.mimeType,
      createdAt: d.createdAt,
    })),
  };
}

/** Finds the form a guest's link points to and runs `fn` limited to that hotel's data. */
export async function withFormLink<T>(token: string, fn: (form: GuestForm, hotel: Hotel) => Promise<T>): Promise<T> {
  const form = token ? await rawPrisma.guestForm.findUnique({ where: { token }, include: { hotel: true } }) : null;
  if (!form) fail("This link is not valid. Please ask the hotel to send the form again.", 404);
  if (form.hotel.status !== "active") fail("This form is closed. Please contact the hotel.", 403);
  const { hotel, ...rest } = form;
  return runForHotel(form.hotelId, () => fn(rest, hotel));
}

/** Only a form that is still waiting for the guest can be changed by the guest. */
export function assertFormOpen(form: GuestForm) {
  const status = formStatus(form);
  if (status === "submitted" || status === "booked") fail("Your details have already been sent to the hotel. Thank you!", 409);
  if (status === "cancelled") fail("This form has been closed by the hotel. Please contact them.", 410);
  if (status === "expired") fail("This link has expired. Please ask the hotel to send a new one.", 410);
}
