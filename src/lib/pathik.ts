// The police guest register used in Gujarat (Pathik, pathik.guru). The front desk enters every
// stay there. This file turns a booking (or just a guest) into the values of Pathik's "Add Guest"
// form, so the Pathik helper add-on can fill the form in the browser. No database code here.
import { isIndian, parseCompanions } from "./guest-form";

export const PATHIK_ADD_URL = "https://pathik.guru/dashboard/add";

/** One person as Pathik asks for them. Aadhaar: the type only; the number and photo are typed in Pathik by hand. */
export interface PathikPerson {
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  docType: string | null; // aadhar, passport, driving_licence, voter_id, pan, other
  docNumber: string;
}

export interface PathikGuest extends PathikPerson {
  company: string;
  address: string;
  locality: string;
  city: string;
  district: string;
  zipCode: string;
  country: string;
  state: string;
  dateOfBirth: string; // yyyy-mm-dd
  phone: string;
  email: string;
}

export interface PathikStay {
  roomNumber: string;
  checkInDate: string; // yyyy-mm-dd
  checkInTime: string; // HH:MM, 24 hours
  checkOutDate: string;
  checkOutTime: string;
  adults: number;
  children: number;
  comingFrom: string;
  goingTo: string;
  vehicleType: string | null; // four_wheeler, two_wheeler, bus, auto, other, none; null = not asked yet
  vehicleNumber: string;
}

export interface PathikRecord {
  /** What this is, for the add-on's panel: "Booking #1023 · Room 204". */
  title: string;
  guest: PathikGuest;
  stay: PathikStay | null;
  /** The other adults in the room, in order. */
  others: PathikPerson[];
  /** Details Pathik needs that are not in the software yet: fill them in here first, or type them in Pathik. */
  missing: string[];
  /** What is always done in Pathik by hand (ID numbers the desk does not keep, and every ID photo). */
  byHand: string[];
}

export interface PathikInput {
  guest: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    nationality: string;
    company: string | null;
    address: string | null;
    locality: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    pinCode: string | null;
    dateOfBirth: Date | string | null;
    idType: string | null;
  };
  booking?: {
    number: number;
    roomNumber: string;
    checkInDate: Date | string;
    checkOutDate: Date | string;
    actualCheckIn: Date | string | null;
    actualCheckOut: Date | string | null;
    adults: number;
    children: number;
    comingFrom: string | null;
    goingTo: string | null;
    vehicleNumber: string | null;
    vehicleType: string | null;
    companions: string | null;
  };
  /** The ID types ticked at the desk, by person (null = the guest). */
  idChecks?: Array<{ person: string | null; idType: string | null }>;
  hotel: { timezone: string; checkInTime: string; checkOutTime: string };
}

const COUNTRIES: Record<string, string> = {
  indian: "India",
  american: "United States",
  british: "United Kingdom",
  english: "United Kingdom",
  french: "France",
  german: "Germany",
  italian: "Italy",
  spanish: "Spain",
  dutch: "Netherlands",
  canadian: "Canada",
  australian: "Australia",
  "new zealander": "New Zealand",
  nepali: "Nepal",
  nepalese: "Nepal",
  bangladeshi: "Bangladesh",
  "sri lankan": "Sri Lanka",
  bhutanese: "Bhutan",
  chinese: "China",
  japanese: "Japan",
  korean: "South Korea",
  russian: "Russia",
  emirati: "United Arab Emirates",
  singaporean: "Singapore",
  malaysian: "Malaysia",
  thai: "Thailand",
  israeli: "Israel",
  irish: "Ireland",
  swiss: "Switzerland",
  swedish: "Sweden",
  south_african: "South Africa",
};

/** "Indian" → "India", "French" → "France"; a country name stays as it is. */
export function countryOf(nationality: string | null | undefined) {
  const n = (nationality ?? "").trim();
  if (isIndian(n)) return "India";
  return COUNTRIES[n.toLowerCase()] ?? COUNTRIES[n.toLowerCase().replace(/\s+/g, "_")] ?? n;
}

/** Pathik wants first, middle and last names. "Ravi Kumar Shah" with no surname gives Ravi / Kumar / Shah. */
export function splitName(firstName: string, lastName = "") {
  const words = firstName.trim().split(/\s+/).filter(Boolean);
  const last = lastName.trim();
  if (last) return { firstName: words[0] ?? "", middleName: words.slice(1).join(" "), lastName: last };
  if (words.length <= 1) return { firstName: words[0] ?? "", middleName: "", lastName: "" };
  return { firstName: words[0], middleName: words.slice(1, -1).join(" "), lastName: words[words.length - 1] };
}

/** An Indian mobile as 10 digits ("+91 98450 11223" → "9845011223"); other numbers as digits with their +. */
export function mobileFor(phone: string | null | undefined, indian: boolean) {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (indian) {
    const d = digits.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) return d.slice(2);
    if (d.length === 11 && d.startsWith("0")) return d.slice(1);
    return d;
  }
  return digits;
}

function dateKey(d: Date | string | null | undefined) {
  if (!d) return "";
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

/** The hotel's own date and time of a moment: { date: "2026-11-03", time: "14:05" }. */
function localDateTime(at: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function person(name: { firstName: string; lastName?: string }, mobile: string, docType: string | null, docNumber: string): PathikPerson {
  const n = splitName(name.firstName, name.lastName);
  return { ...n, fullName: [n.firstName, n.middleName, n.lastName].filter(Boolean).join(" "), mobile, docType, docNumber };
}

/** Everything Pathik's "Add Guest" form asks for, from what the software knows. */
export function pathikRecord(input: PathikInput): PathikRecord {
  const g = input.guest;
  const b = input.booking;
  const indian = isIndian(g.nationality);
  const checks = input.idChecks ?? [];
  // The guest's ID: what is on their record, else the type ticked at the desk.
  const docType = g.idType ?? checks.find((c) => c.person === null)?.idType ?? null;
  const mobile = mobileFor(g.phone, indian);
  // No ID numbers are kept in the software: they are typed in Pathik.
  const main = person(g, mobile, docType, "");

  const guest: PathikGuest = {
    ...main,
    company: g.company ?? "",
    address: g.address ?? "",
    // Pathik asks for a locality: the area if known, else the city.
    locality: g.locality || g.city || "",
    city: g.city ?? "",
    district: g.district ?? "",
    zipCode: (g.pinCode ?? "").replace(/\s/g, ""),
    country: countryOf(g.nationality),
    state: g.state ?? "",
    dateOfBirth: dateKey(g.dateOfBirth),
    phone: mobile,
    email: g.email ?? "",
  };

  let stay: PathikStay | null = null;
  let others: PathikPerson[] = [];
  if (b) {
    const inAt = b.actualCheckIn ? localDateTime(b.actualCheckIn, input.hotel.timezone) : { date: dateKey(b.checkInDate), time: input.hotel.checkInTime };
    const outAt = b.actualCheckOut ? localDateTime(b.actualCheckOut, input.hotel.timezone) : { date: dateKey(b.checkOutDate), time: input.hotel.checkOutTime };
    stay = {
      roomNumber: b.roomNumber,
      checkInDate: inAt.date,
      checkInTime: inAt.time,
      checkOutDate: outAt.date,
      checkOutTime: outAt.time,
      adults: b.adults,
      children: b.children,
      comingFrom: b.comingFrom ?? "",
      goingTo: b.goingTo ?? "",
      vehicleType: b.vehicleType || null,
      vehicleNumber: b.vehicleNumber ?? "",
    };
    others = parseCompanions(b.companions).map((c) => {
      const type = c.aadhaarAtDesk ? "aadhar" : (checks.find((x) => x.person === c.name)?.idType ?? null);
      return person({ firstName: c.name }, mobileFor(c.phone, indian), type, "");
    });
  }

  const missing: string[] = [];
  const need = (ok: unknown, label: string) => !ok && missing.push(label);
  need(guest.firstName, "First name");
  need(guest.lastName, "Last name (surname)");
  need(guest.address, "Address");
  need(guest.city, "City");
  need(guest.district, "District");
  need(guest.zipCode, "PIN code");
  need(guest.state, "State");
  need(guest.dateOfBirth, "Date of birth");
  need(guest.mobile, "Mobile number");
  need(guest.email, "Email");
  need(docType, "ID proof type");
  if (stay) {
    need(stay.comingFrom, "Coming from");
    need(stay.goingTo, "Going to");
    need(stay.vehicleType, "How the guest travels (vehicle type)");
    if (others.length < stay.adults - 1) missing.push(`Names of the other ${stay.adults - 1 - others.length === 1 ? "adult" : `${stay.adults - 1 - others.length} adults`}`);
    others.forEach((o) => need(o.docType, `ID proof type of ${o.fullName}`));
  }

  // The desk only ticks which ID it saw: no numbers or copies are kept, so they are added in Pathik.
  const byHand: string[] = [];
  const withId = [...(docType ? [guest.fullName] : []), ...others.filter((o) => o.docType).map((o) => o.fullName)];
  if (withId.length) byHand.push(`ID number and photo for ${withId.join(", ")}`);

  const title = b ? `Booking #${b.number} · Room ${b.roomNumber} · ${guest.fullName}` : guest.fullName;
  return { title, guest, stay, others, missing, byHand };
}
