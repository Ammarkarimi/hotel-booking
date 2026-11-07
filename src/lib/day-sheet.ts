// The day sheet: one page (or one WhatsApp message) with everything the front desk needs
// if the power or internet goes. Built from the Dashboard's data, so it also works from the
// copy saved on the computer when the internet is down. Pure: used by the screen and the tests.
import { diffDays } from "./dates";
import { formatCurrency, formatDate, label } from "./utils";

export interface DaySheetBooking {
  number: number;
  guestName: string;
  guest: { phone: string };
  room: { roomNumber: string; type: string };
  adults: number;
  children: number;
  checkInDate: string;
  checkOutDate: string;
  folio: { balance: number };
}

export interface DaySheetRoom {
  roomNumber: string;
  type: string;
  status: string;
  housekeeping: string;
  freeTonight: boolean;
  guestName: string | null;
  arrivingGuest: string | null;
}

export interface DaySheetData {
  today: string;
  hotelName: string;
  stats: { collectedToday: number; owed: number };
  arrivals: DaySheetBooking[];
  inHouse: DaySheetBooking[];
  rooms: DaySheetRoom[];
}

const byRoom = (a: { room: { roomNumber: string } }, b: { room: { roomNumber: string } }) =>
  a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, { numeric: true });

/** Everything on the sheet, in the order it is printed. */
export function daySheet(data: DaySheetData) {
  const staying = [...data.inHouse].sort(byRoom);
  const arriving = [...data.arrivals].sort(byRoom);
  const usable = data.rooms.filter((r) => r.status !== "maintenance");
  const free = usable
    .filter((r) => r.freeTonight)
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  const notUsable = data.rooms.filter((r) => r.status === "maintenance").map((r) => r.roomNumber);
  return {
    staying,
    leavingToday: staying.filter((b) => b.checkOutDate <= data.today),
    arriving,
    free,
    notUsable,
    collectedToday: data.stats.collectedToday,
    owed: data.stats.owed,
  };
}

export function nightsOf(b: Pick<DaySheetBooking, "checkInDate" | "checkOutDate">) {
  return Math.max(1, diffDays(b.checkInDate, b.checkOutDate));
}

export function leavesText(b: Pick<DaySheetBooking, "checkOutDate">, today: string) {
  if (b.checkOutDate < today) return `Was due ${formatDate(b.checkOutDate)}`;
  return b.checkOutDate === today ? "Today" : formatDate(b.checkOutDate);
}

/** "103 Twin (after check-out)": a free room and anything to do before it can be given. */
export function freeRoomText(r: DaySheetRoom) {
  const notes = [r.guestName ? "after check-out" : "", r.housekeeping !== "clean" ? "needs cleaning" : ""].filter(Boolean);
  return `${r.roomNumber} ${label(r.type)}${notes.length ? ` (${notes.join(", ")})` : ""}`;
}

/** The same sheet as a WhatsApp message. */
export function daySheetText(data: DaySheetData, at: string) {
  const s = daySheet(data);
  const due = (n: number) => (n > 0.5 ? `, due ${formatCurrency(n)}` : "");
  const lines = [`*${data.hotelName}: day sheet, ${formatDate(data.today)}* (${at})`, ""];

  lines.push(`*In the hotel (${s.staying.length})*`);
  if (s.staying.length === 0) lines.push("No guests in.");
  for (const b of s.staying) {
    lines.push(`${b.room.roomNumber} ${b.guestName}, ${b.guest.phone}, leaves ${leavesText(b, data.today).replace(/^(Today|Was)/, (w) => w.toLowerCase())}${due(b.folio.balance)}`);
  }

  lines.push("", `*Arriving today (${s.arriving.length})*`);
  if (s.arriving.length === 0) lines.push("No arrivals.");
  for (const b of s.arriving) {
    lines.push(`#${b.number} ${b.guestName}, ${b.guest.phone}, room ${b.room.roomNumber}, ${nightsOf(b)} night${nightsOf(b) === 1 ? "" : "s"}${due(b.folio.balance)}`);
  }

  lines.push("", `*Free tonight (${s.free.length})*`);
  lines.push(s.free.length ? s.free.map(freeRoomText).join(", ") : "None.");
  if (s.notUsable.length) lines.push(`Not usable: ${s.notUsable.join(", ")}`);

  lines.push("", `Received today: ${formatCurrency(s.collectedToday)}`, `Still to collect: ${formatCurrency(s.owed)}`);
  return lines.join("\n");
}
