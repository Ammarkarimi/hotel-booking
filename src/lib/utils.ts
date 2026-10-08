import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let currencyCode = "INR";

/** Called once by the app shell with the hotel's currency setting. */
export function setCurrency(code: string) {
  currencyCode = code || "INR";
}

export function formatCurrency(amount: number, currency = currencyCode): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(Math.round(amount * 100) / 100) ? 0 : 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0)}`;
  }
}

export function formatDate(date: Date | string): string {
  // Plain date keys are calendar dates; show them without timezone shifts.
  const isKey = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(isKey && { timeZone: "UTC" }),
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone && { timeZone }),
  }).format(new Date(date));
}

export function parseAmenities(amenities: string): string[] {
  try {
    const parsed = JSON.parse(amenities);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return amenities ? amenities.split(",").map((a) => a.trim()).filter(Boolean) : [];
  }
}

export function stringifyAmenities(amenities: string[]): string {
  return JSON.stringify(amenities.map((a) => a.trim()).filter(Boolean));
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ROOM_TYPES = ["single", "double", "twin", "deluxe", "suite", "family", "dormitory"] as const;
export const ROOM_STATUSES = ["available", "occupied", "maintenance"] as const;
export const HOUSEKEEPING_STATUSES = ["clean", "dirty", "cleaning"] as const;
export const DOCUMENT_TYPES = ["aadhar", "pan", "passport", "visa", "driving_licence", "voter_id", "other"] as const;
export const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "other"] as const;
export const BOOKING_STATUSES = ["reserved", "checked_in", "checked_out", "cancelled", "no_show"] as const;
export const BOOKING_SOURCES = [
  "walk_in",
  "phone",
  "website",
  "booking_com",
  "makemytrip",
  "goibibo",
  "agoda",
  "airbnb",
  "expedia",
  "travel_agent",
  "corporate",
  "other",
] as const;
export const CHARGE_CATEGORIES = ["food", "laundry", "minibar", "transport", "extra_bed", "damage", "other"] as const;
export const AMENITY_SUGGESTIONS = ["WiFi", "AC", "TV", "Hot Water", "Mini Bar", "Balcony", "Room Service", "Kettle", "Safe", "Bathtub", "Sea View", "Extra Bed"];

// Plain-language labels so people who are new to hotel software understand them.
export const LABELS: Record<string, string> = {
  // booking status
  reserved: "Booked",
  checked_in: "Staying",
  checked_out: "Left",
  cancelled: "Cancelled",
  no_show: "Did not come",
  // room status
  available: "Free",
  occupied: "Guest inside",
  maintenance: "Not usable (repair)",
  // housekeeping
  clean: "Clean",
  dirty: "Needs cleaning",
  cleaning: "Being cleaned",
  // payments
  cash: "Cash",
  upi: "UPI / QR",
  card: "Card",
  bank_transfer: "Bank transfer",
  advance: "Advance",
  balance: "Balance",
  full: "Full payment",
  refund: "Refund",
  // sources
  walk_in: "Walk-in",
  phone: "Phone call",
  website: "Our website",
  booking_com: "Booking.com",
  makemytrip: "MakeMyTrip",
  goibibo: "Goibibo",
  agoda: "Agoda",
  airbnb: "Airbnb",
  expedia: "Expedia",
  travel_agent: "Travel agent",
  corporate: "Company",
  // documents
  aadhar: "Aadhaar card",
  pan: "PAN card",
  passport: "Passport",
  visa: "Visa",
  driving_licence: "Driving licence",
  voter_id: "Voter ID",
  // charges
  food: "Food & drinks",
  laundry: "Laundry",
  minibar: "Minibar",
  transport: "Taxi / transport",
  extra_bed: "Extra bed",
  damage: "Damage",
  other: "Other",
  // payment state
  unpaid: "Not paid",
  partial: "Part paid",
  paid: "Fully paid",
  overpaid: "Paid extra",
  // roles
  admin: "Owner / Manager",
  staff: "Front desk",
};

export function label(key: string | null | undefined): string {
  if (!key) return "";
  return LABELS[key] ?? titleCase(key);
}

export type RoomType = (typeof ROOM_TYPES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
