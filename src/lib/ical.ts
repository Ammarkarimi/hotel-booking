// Calendar files (iCal, RFC 5545) as booking sites write and read them: Airbnb, Booking.com,
// Agoda, Vrbo… Pure: no database code here, so it can be tested by itself.
import { addDays, diffDays, isDateKey, todayKey } from "./dates";
import { splitGuestName } from "./channels";

export interface IcalEvent {
  uid: string;
  /** The first night (date key). */
  start: string;
  /** The leaving day (date key): the night before it is the last one taken. */
  end: string;
  summary: string;
  description: string;
  status: string;
}

export interface ParsedIcal {
  /** False when the text is not a calendar at all (an error page, a sign-in page…). */
  valid: boolean;
  events: IcalEvent[];
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** "NAME;PARAM=x;OTHER="a:b":value" → its three parts. */
function parseLine(line: string): Property | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 1) return null;
  const head: string[] = [];
  let part = "";
  quoted = false;
  for (const c of line.slice(0, colon)) {
    if (c === '"') quoted = !quoted;
    if (c === ";" && !quoted) {
      head.push(part);
      part = "";
    } else part += c;
  }
  head.push(part);
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf("=");
    if (eq < 1) continue;
    params[p.slice(0, eq).trim().toUpperCase()] = p.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return { name: head[0].trim().toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c)).trim();
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * The calendar day of a DTSTART / DTEND value. A time written in UTC ("…Z") is turned into the
 * hotel's own day when its time zone is given; any other time is taken as written.
 */
function dayOf(prop: Property, timeZone?: string): { day: string; timed: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(prop.value.trim());
  if (!m) return null;
  let day = `${m[1]}-${m[2]}-${m[3]}`;
  if (!isDateKey(day)) return null;
  const timed = m[4] !== undefined;
  if (timed && m[7] && timeZone) {
    const at = new Date(`${day}T${m[4]}:${m[5]}:${m[6] ?? "00"}Z`);
    if (!Number.isNaN(at.getTime())) day = todayKey(timeZone, at);
  }
  return { day, timed };
}

/** Whole days in a DURATION such as P3D, P1W or P2DT12H (part of a day counts as one more). */
function durationDays(value: string): number | null {
  const m = /^\+?P(?:(\d+)W)?(?:(\d+)D)?(T.+)?$/.exec(value.trim().toUpperCase());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 7 + Number(m[2] ?? 0);
}

/** A short, stable code for a text (for events that come without an ID). */
function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Reads a calendar file. Each event comes back as a stay: the first night and the leaving day.
 * Cancelled events are left out. `timeZone` is the hotel's, for times written in UTC.
 */
export function parseIcal(text: string, opts: { timeZone?: string } = {}): ParsedIcal {
  const unfolded = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n");
  const valid = /^BEGIN:VCALENDAR\s*$/im.test(unfolded) && /^END:VCALENDAR\s*$/im.test(unfolded);
  const events: IcalEvent[] = [];
  if (!valid) return { valid, events };

  let current: Record<string, Property> | null = null;
  let nested = 0; // inside an alarm or other part of an event: its lines are not the event's
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    const value = prop.value.trim().toUpperCase();
    if (prop.name === "BEGIN") {
      if (value === "VEVENT" && !current) {
        current = {};
        nested = 0;
      } else if (current) nested += 1;
      continue;
    }
    if (prop.name === "END") {
      if (current && nested > 0) nested -= 1;
      else if (current && value === "VEVENT") {
        const event = toEvent(current, opts.timeZone);
        if (event) events.push(event);
        current = null;
      }
      continue;
    }
    if (current && nested === 0 && !(prop.name in current)) current[prop.name] = prop;
  }
  return { valid, events };
}

function toEvent(props: Record<string, Property>, timeZone?: string): IcalEvent | null {
  const status = (props.STATUS?.value ?? "").trim().toUpperCase();
  if (status === "CANCELLED") return null;
  const from = props.DTSTART ? dayOf(props.DTSTART, timeZone) : null;
  if (!from) return null;
  const start = from.day;
  let end: string | null = null;
  const to = props.DTEND ? dayOf(props.DTEND, timeZone) : null;
  if (to) end = to.day;
  else if (props.DURATION) {
    const days = durationDays(props.DURATION.value);
    if (days !== null) end = addDays(start, days);
  }
  // No end, or an end on the same day: one night.
  if (!end || end <= start) end = addDays(start, 1);
  const summary = unescapeText(props.SUMMARY?.value ?? "");
  const description = unescapeText(props.DESCRIPTION?.value ?? "");
  const uid = (props.UID?.value ?? "").trim() || `no-id-${start}-${end}-${shortHash(summary.toLowerCase())}`;
  return { uid, start, end, summary, description, status };
}

/** Lines may be at most 75 bytes long; longer ones go on with a space at the start of the next line. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let part = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      out.push(part);
      part = "";
      bytes = 0;
      limit = 74; // the space in front counts too
    }
    part += ch;
    bytes += size;
  }
  out.push(part);
  return out.join("\r\n ");
}

const compact = (day: string) => day.replace(/-/g, "");

export interface IcalOutEvent {
  uid: string;
  start: string; // first night
  end: string; // the leaving day
  summary: string;
  description?: string;
}

/** Writes a calendar file of whole-day events, as booking sites read it. */
export function buildIcal(calendar: { name: string; events: IcalOutEvent[]; now?: Date }): string {
  const stamp = (calendar.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "PRODID:-//Innvela//Hotel calendar//EN", "VERSION:2.0", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapeText(calendar.name)}`];
  for (const e of calendar.events) {
    if (!isDateKey(e.start) || !isDateKey(e.end)) continue;
    const end = e.end > e.start ? e.end : addDays(e.start, 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid.replace(/[\r\n]/g, " ")}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.start)}`,
      `DTEND;VALUE=DATE:${compact(end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ───────────────────────── What a site's event means ─────────────────────────

/** The ending of every event ID in the calendar we give out, so our own events are known when a site sends them back. */
export const OWN_UID_SUFFIX = "@innvela";

export interface ImportedEvent {
  /**
   * "reservation": the site sold these nights to a guest. "block": the site only says the nights
   * are not free, which is also how it shows the nights it read from OUR calendar.
   */
  kind: "reservation" | "block";
  guest: { firstName: string; lastName: string };
  /** The site's own booking number, when it gives one. */
  otaReference: string | null;
  notes: string | null;
}

const BLOCK_WORDS = /\b(not available|unavailable|blocked|block|closed|closure|no vacancy|maintenance|owner stay|hold)\b/i;
const PLAIN_WORDS = /\b(reserved|reservation|booked|booking|confirmed|guest|stay|airbnb|booking\.com|agoda|vrbo|homeaway|expedia|makemytrip|goibibo|tripadvisor|com)\b/gi;

/** Is this event a guest's reservation or a plain "not available"? And what the site tells about the guest. */
export function classifyEvent(event: { uid?: string; summary: string; description?: string }, source: string): ImportedEvent {
  const summary = event.summary.replace(/\s+/g, " ").trim();
  const description = event.description ?? "";

  const code =
    /reservations?\/details\/([A-Z0-9]{6,20})/i.exec(description)?.[1] ??
    /(?:booking|reservation|confirmation)\s*(?:id|no\.?|number|code|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,24})/i.exec(`${description}\n${summary}`)?.[1] ??
    null;
  const lastFour = /phone number\s*\(last 4 digits\)\s*:\s*(\d{4})/i.exec(description)?.[1] ?? null;

  // "Reserved - John Smith", "Booked: Asha Rao", or just the guest's name.
  const afterDash = /^(?:reserved|reservation|booked|booking|confirmed)\s*[-–—:|]\s*(.+)$/i.exec(summary)?.[1] ?? summary;
  const nameText = afterDash
    .replace(/\([^)]*\)/g, " ")
    .replace(PLAIN_WORDS, " ")
    .replace(/[^\p{L}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasName = /\p{L}{2,}/u.test(nameText) && !BLOCK_WORDS.test(summary);

  const reservationWord = /\b(reserved|reservation|booked|confirmed)\b/i.test(summary);
  const isBlock = BLOCK_WORDS.test(summary) || (!reservationWord && !hasName && !code);

  const notes = [
    isBlock ? null : lastFour ? `Guest's phone number ends in ${lastFour}.` : null,
  ].filter(Boolean);

  return {
    kind: isBlock ? "block" : "reservation",
    guest: (() => {
      const g = splitGuestName(!isBlock && hasName ? nameText : null, source);
      return { firstName: g.firstName, lastName: g.lastName };
    })(),
    otaReference: isBlock ? null : code ? code.toUpperCase() : null,
    notes: notes.length ? notes.join("\n") : null,
  };
}

// ───────────────────────── The echo rule ─────────────────────────

export interface KnownStay {
  ref: string;
  checkIn: string;
  checkOut: string;
}

/**
 * A site that reads our calendar blocks those nights and then shows them in its own calendar as
 * "not available", sometimes joined with its own nights into one long block. So from a block we
 * take away the nights that are already taken in our books (`taken`), and what is left is
 * written, each run of nights as its own stay. Nothing left = only an echo of our own bookings.
 *
 * Nights before today are never written. A run keeps the ref of the stay it already made
 * (`known`: this calendar's stays that are still booked), so a block that grows, shrinks or runs
 * over several days stays one booking; a new run is "<refBase>:<first night>".
 */
export function blockStays(opts: {
  event: { start: string; end: string };
  refBase: string;
  today: string;
  taken: (night: string) => boolean;
  known?: KnownStay[];
}): KnownStay[] {
  const { event, refBase, today, taken } = opts;
  const first = event.start < today ? today : event.start;
  const count = diffDays(first, event.end);
  const runs: Array<{ checkIn: string; checkOut: string }> = [];
  let open: { checkIn: string; checkOut: string } | null = null;
  for (let i = 0; i < count; i++) {
    const night = addDays(first, i);
    if (taken(night)) {
      open = null;
      continue;
    }
    if (open) open.checkOut = addDays(night, 1);
    else {
      open = { checkIn: night, checkOut: addDays(night, 1) };
      runs.push(open);
    }
  }

  const mine = (opts.known ?? []).filter((k) => k.ref.startsWith(`${refBase}:`));
  const used = new Set<string>();
  return runs.map((run) => {
    const exact = `${refBase}:${run.checkIn}`;
    // The stay this run already is: one that started before today and is still going on, or one that shares nights with it.
    const going = run.checkIn === today ? mine.find((k) => !used.has(k.ref) && k.checkIn < today && k.checkOut >= today) : undefined;
    const same = going ?? mine.find((k) => !used.has(k.ref) && k.ref === exact) ?? mine.find((k) => !used.has(k.ref) && k.checkIn < run.checkOut && run.checkIn < k.checkOut);
    if (!same) {
      used.add(exact);
      return { ref: exact, ...run };
    }
    used.add(same.ref);
    return { ref: same.ref, checkIn: going ? same.checkIn : run.checkIn, checkOut: run.checkOut };
  });
}

// ───────────────────────── Which links we are willing to read ─────────────────────────

/** An address inside a private network or the machine itself: never read from there. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (ip.includes(":")) {
    // Only ordinary public addresses (2000::/3) pass: not ::1, fc00::/7, fe80::/10, or an IPv4 address written as IPv6.
    const first = parseInt(ip.split(":")[0] || "0", 16);
    return !(first >= 0x2000 && first <= 0x3fff);
  }
  return false;
}

export type FeedUrlCheck = { ok: true; url: string } | { ok: false; message: string };

/**
 * Checks a calendar link someone pasted, so the server is never made to read from inside its own
 * network. `allowLocal` is for tests only.
 */
export function checkFeedUrl(raw: string, allowLocal = false): FeedUrlCheck {
  const text = raw.trim().replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, message: "This does not look like a link. It should start with https://" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, message: "The calendar link must start with https://" };
  if (text.length > 2000) return { ok: false, message: "This link is too long." };
  if (url.username || url.password) return { ok: false, message: "A calendar link with a user name or password in it cannot be used." };
  if (allowLocal) return { ok: true, url: url.toString() };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const literal = host.startsWith("[") || /^[\d.]+$/.test(host);
  const inside = host === "localhost" || /\.(localhost|local|internal|lan|home|intranet)$/.test(host) || (!literal && !host.includes(".")) || (literal && isPrivateAddress(host));
  if (inside) return { ok: false, message: "This link points inside a private network and cannot be read. Copy the calendar link from the booking site." };
  return { ok: true, url: url.toString() };
}
