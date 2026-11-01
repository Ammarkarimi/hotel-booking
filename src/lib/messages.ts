// WhatsApp messages to guests. The owner can change the wording in Settings; {fields} are filled
// in from the booking. A line whose field has nothing to show (for example no invoice yet) is left
// out. No database code here, so screens and tests can use it.
import { formatCurrency, formatDate, formatDateTime, label } from "./utils";

export const MESSAGE_KINDS = ["booking", "checkIn", "checkOut"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const MESSAGE_TITLES: Record<MessageKind, { title: string; when: string }> = {
  booking: { title: "Booking confirmation", when: "Sent after a booking is made, and from the booking page before the guest arrives." },
  checkIn: { title: "Welcome at check-in", when: "Offered right after check-in, and from the booking page while the guest is staying." },
  checkOut: { title: "Thank you at check-out", when: "Offered right after check-out, and from the booking page after the guest has left." },
};

export const DEFAULT_MESSAGES: Record<MessageKind, string> = {
  booking: [
    "Dear {guest},",
    "Your booking at {hotel} is confirmed.",
    "",
    "Booking no: #{booking_no}",
    "Room: {room_type} room",
    "Guests: {guests}",
    "Arrival: {arrival_date}, check-in from {check_in_time}",
    "Departure: {leaving_date}, check-out by {check_out_time}",
    "Total: {total}",
    "Paid: {paid}",
    "Balance to pay: {balance}",
    "",
    "Questions? Call us on {hotel_phone}",
    "Thank you for choosing {hotel}!",
  ].join("\n"),
  checkIn: [
    "Welcome to {hotel}, {guest}!",
    "",
    "You are checked in. Your stay details:",
    "Booking no: #{booking_no}",
    "Room: {room_no} ({room_type})",
    "Guests: {guests}",
    "Checked in: {checked_in_at}",
    "Check-out: {leaving_date} by {check_out_time}",
    "",
    "Bill so far: {total}",
    "Paid: {paid}",
    "Balance: {balance}",
    "",
    "Please check out by {check_out_time} on {leaving_date}. Staying later may be charged extra.",
    "For anything you need, call the front desk on {hotel_phone}.",
    "",
    "Thank you for staying at {hotel}!",
  ].join("\n"),
  checkOut: [
    "Dear {guest},",
    "You have checked out of {hotel}.",
    "",
    "Booking no: #{booking_no}",
    "Invoice: {invoice_no}",
    "Stay: {arrival_date} to {leaving_date} ({nights})",
    "Checked out: {checked_out_at}",
    "Total bill: {total}",
    "Paid: {paid}",
    "Balance: {balance}",
    "",
    "Thank you for staying at {hotel}! We hope to see you again.",
    "For your next booking call us on {hotel_phone}.",
  ].join("\n"),
};

export const MESSAGE_FIELDS: { key: string; label: string }[] = [
  { key: "hotel", label: "Hotel name" },
  { key: "guest", label: "Guest name" },
  { key: "booking_no", label: "Booking number" },
  { key: "room_type", label: "Room type" },
  { key: "room_no", label: "Room number" },
  { key: "guests", label: "Adults and children" },
  { key: "arrival_date", label: "Arrival date" },
  { key: "leaving_date", label: "Leaving date" },
  { key: "nights", label: "Number of nights" },
  { key: "check_in_time", label: "Hotel check-in time" },
  { key: "check_out_time", label: "Hotel check-out time" },
  { key: "checked_in_at", label: "When the guest checked in" },
  { key: "checked_out_at", label: "When the guest checked out" },
  { key: "total", label: "Bill total" },
  { key: "paid", label: "Paid so far" },
  { key: "balance", label: "Balance to pay" },
  { key: "invoice_no", label: "Invoice number" },
  { key: "hotel_phone", label: "Hotel phone" },
  { key: "hotel_address", label: "Hotel address" },
];

/** "14:00" → "2:00 pm". */
export function clockLabel(hhmm: string | null | undefined) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return hhmm ?? "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

export interface MessageBooking {
  guestName: string;
  number: number;
  adults: number;
  children: number;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string | null;
  actualCheckOut?: string | null;
  room: { roomNumber: string; type: string };
  folio: { grandTotal: number; netPaid: number; balance: number; nightCount: number };
  bill?: { invoiceNumber: string | null } | null;
}

export interface MessageHotel {
  hotelName: string;
  checkInTime: string;
  checkOutTime: string;
  phone?: string | null;
  address?: string | null;
  currency?: string;
  timezone?: string;
}

export function messageValues(b: MessageBooking, h: MessageHotel): Record<string, string> {
  const money = (n: number) => formatCurrency(n, h.currency);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return {
    hotel: h.hotelName,
    guest: b.guestName,
    booking_no: String(b.number),
    room_type: label(b.room.type),
    room_no: b.room.roomNumber,
    guests: [plural(b.adults, "adult", "adults"), b.children ? plural(b.children, "child", "children") : ""].filter(Boolean).join(", "),
    arrival_date: formatDate(b.checkInDate),
    leaving_date: formatDate(b.checkOutDate),
    nights: plural(b.folio.nightCount, "night", "nights"),
    check_in_time: clockLabel(h.checkInTime),
    check_out_time: clockLabel(h.checkOutTime),
    checked_in_at: b.actualCheckIn ? formatDateTime(b.actualCheckIn, h.timezone) : "",
    checked_out_at: b.actualCheckOut ? formatDateTime(b.actualCheckOut, h.timezone) : "",
    total: money(b.folio.grandTotal),
    paid: money(b.folio.netPaid),
    balance: money(Math.max(0, b.folio.balance)),
    invoice_no: b.bill?.invoiceNumber ?? "",
    hotel_phone: h.phone ?? "",
    hotel_address: h.address ?? "",
  };
}

/**
 * Fills the {fields} in a message. A line with a field that has nothing to show is left out
 * (so "Invoice: {invoice_no}" disappears before check-out), and blank lines never pile up.
 */
export function fillMessage(template: string, values: Record<string, string>) {
  const lines: string[] = [];
  for (const line of template.replace(/\r\n/g, "\n").split("\n")) {
    let missing = false;
    const filled = line.replace(/\{([a-z_]+)\}/g, (whole, key: string) => {
      if (!(key in values)) return whole;
      if (!values[key]) missing = true;
      return values[key];
    });
    if (missing) continue;
    if (!filled.trim() && (lines.length === 0 || !lines[lines.length - 1].trim())) continue;
    lines.push(filled.trimEnd());
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join("\n");
}

/** The message to send for a booking: the owner's wording if set, otherwise the default. */
export function bookingMessage(kind: MessageKind, b: MessageBooking, h: MessageHotel & { messages?: Partial<Record<MessageKind, string | null>> }) {
  return fillMessage(h.messages?.[kind]?.trim() || DEFAULT_MESSAGES[kind], messageValues(b, h));
}

/** Which message suits a booking now: confirmation before arrival, welcome while staying, thanks after. */
export function messageKindFor(status: string): MessageKind {
  return status === "checked_in" ? "checkIn" : status === "checked_out" ? "checkOut" : "booking";
}
