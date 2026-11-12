// The few Channex API calls the software makes (https://docs.channex.io/api-v.1-documentation).
// Channex passes a hotel's free rooms and prices on to MakeMyTrip, Booking.com, Agoda, Airbnb,
// Expedia… and hands us their bookings. One API key, the software provider's, serves every hotel.

const STAGING = "https://staging.channex.io/api/v1";

/** The software provider has set a Channex API key (CHANNEX_API_KEY). */
export function channexConfigured(): boolean {
  return !!process.env.CHANNEX_API_KEY;
}

export function channexApiUrl(): string {
  return (process.env.CHANNEX_API_URL || STAGING).replace(/\/+$/, "");
}

/** Channex's own website for this API (the address without /api/v1): the embedded screen lives there. */
export function channexServerUrl(): string {
  return channexApiUrl().replace(/\/api\/v1$/, "");
}

/** The test server: nothing reaches a real booking site. */
export function channexSandbox(): boolean {
  try {
    return new URL(channexApiUrl()).hostname !== "app.channex.io";
  } catch {
    return true;
  }
}

export class ChannexError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    /** Seconds Channex asked us to wait (429). */
    public retryAfter?: number
  ) {
    super(message);
    this.name = "ChannexError";
  }
  /** Too many requests in a minute: nothing was applied, try again later. */
  get busy() {
    return this.status === 429;
  }
}

/** { title: ["can't be blank"], rate: ["must be greater than 0"] } → "title can't be blank; rate must be greater than 0". */
export function readableDetails(details: unknown): string {
  if (details == null) return "";
  if (typeof details === "string") return details;
  if (typeof details !== "object") return String(details);
  const parts: string[] = [];
  for (const [field, value] of Object.entries(details as Record<string, unknown>)) {
    const text = Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ") : typeof value === "object" && value ? JSON.stringify(value) : String(value);
    parts.push(`${field.replace(/_/g, " ")} ${text}`);
  }
  return parts.join("; ").slice(0, 500);
}

function errorFrom(status: number, body: unknown, retryAfterHeader: string | null): ChannexError {
  const errors = (body as { errors?: { code?: string; title?: string; details?: unknown } } | null)?.errors;
  if (status === 429) {
    const details = errors?.details as { retry_after?: number } | undefined;
    const wait = Number(details?.retry_after ?? retryAfterHeader) || undefined;
    return new ChannexError(429, "Channex is busy right now (too many updates in one minute). It will be tried again shortly.", errors?.code, wait);
  }
  if (status === 401 || status === 403) {
    return new ChannexError(status, "Channex did not accept the API key. Please tell your software provider.", errors?.code);
  }
  const details = readableDetails(errors?.details);
  const title = errors?.title || `error ${status}`;
  return new ChannexError(status, `Channex: ${title}${details ? ` (${details})` : ""}`, errors?.code);
}

type Query = Record<string, string | number | undefined>;

async function call<T>(path: string, init: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const key = process.env.CHANNEX_API_KEY;
  if (!key) throw new ChannexError(0, "The connection to booking sites is not switched on (no Channex API key).");
  const url = new URL(`${channexApiUrl()}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "user-api-key": key, Accept: "application/json", ...(init.body !== undefined && { "Content-Type": "application/json" }) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ChannexError(0, "Cannot reach Channex right now. It will be tried again shortly.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw errorFrom(res.status, data, res.headers.get("retry-after"));
  return data as T;
}

interface Resource<A = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: A;
}

// ---- Property, room types, rate plans ---------------------------------------------------------

export async function createProperty(property: Record<string, unknown>): Promise<string> {
  const res = await call<{ data: Resource }>("/properties", { method: "POST", body: { property } });
  return res.data.id;
}

export async function createRoomType(roomType: Record<string, unknown>): Promise<string> {
  const res = await call<{ data: Resource }>("/room_types", { method: "POST", body: { room_type: roomType } });
  return res.data.id;
}

/** Only the fields given are changed. */
export async function updateRoomType(id: string, roomType: Record<string, unknown>): Promise<void> {
  await call(`/room_types/${encodeURIComponent(id)}`, { method: "PUT", body: { room_type: roomType } });
}

export async function createRatePlan(ratePlan: Record<string, unknown>): Promise<string> {
  const res = await call<{ data: Resource }>("/rate_plans", { method: "POST", body: { rate_plan: ratePlan } });
  return res.data.id;
}

// ---- Free rooms and prices --------------------------------------------------------------------

interface AriAnswer {
  data?: unknown[];
  meta?: { message?: string; warnings?: unknown[] };
}

/** An entry Channex did not apply, in plain words: "2026-11-12 to 2026-11-14: rate must be greater than 0". */
function warningText(w: unknown): string {
  if (typeof w === "string") return w;
  const o = (w ?? {}) as Record<string, unknown>;
  const when = o.date ?? (o.date_from ? `${o.date_from} to ${o.date_to}` : "");
  const why = readableDetails(o.warning ?? o);
  return [when, why].filter(Boolean).join(": ");
}

function warningsOf(res: AriAnswer): string[] {
  return (res.meta?.warnings ?? []).map(warningText).filter(Boolean);
}

/** Free rooms per room type and date range (both dates included). Returns what Channex did not apply. */
export async function sendAvailability(values: unknown[]): Promise<string[]> {
  if (!values.length) return [];
  return warningsOf(await call<AriAnswer>("/availability", { method: "POST", body: { values } }));
}

/** Prices per rate plan and date range (both dates included). Returns what Channex did not apply. */
export async function sendRestrictions(values: unknown[]): Promise<string[]> {
  if (!values.length) return [];
  return warningsOf(await call<AriAnswer>("/restrictions", { method: "POST", body: { values } }));
}

// ---- Bookings ---------------------------------------------------------------------------------

export interface ChannexRevisionRoom {
  room_type_id?: string | null;
  rate_plan_id?: string | null;
  checkin_date?: string | null;
  checkout_date?: string | null;
  amount?: string | number | null;
  days?: Record<string, string | number> | null;
  occupancy?: { adults?: number | null; children?: number | null; infants?: number | null } | null;
  is_cancelled?: boolean | null;
}

/** One version of a booking as a site sent it: new, changed or cancelled. */
export interface ChannexRevision {
  id: string;
  booking_id: string;
  property_id: string;
  status: string; // new, modified, cancelled
  ota_name?: string | null;
  secondary_ota?: string | null; // e.g. "MakeMyTrip" when ota_name is "Goibibo"
  ota_reservation_code?: string | null;
  unique_id?: string | null;
  arrival_date?: string | null;
  departure_date?: string | null;
  arrival_hour?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  notes?: string | null;
  payment_collect?: string | null; // property, ota
  ota_commission?: string | number | null;
  customer?: {
    name?: string | null;
    surname?: string | null;
    mail?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
  occupancy?: { adults?: number | null; children?: number | null; infants?: number | null } | null;
  rooms?: ChannexRevisionRoom[] | null;
}

/** Bookings, changes and cancellations we have not confirmed receiving yet, oldest first. */
export async function bookingFeed(propertyId: string, page = 1, limit = 50): Promise<ChannexRevision[]> {
  const res = await call<{ data?: Array<Resource<ChannexRevision>> }>("/booking_revisions/feed", {
    query: { "filter[property_id]": propertyId, "order[inserted_at]": "asc", "pagination[page]": page, "pagination[limit]": limit },
  });
  return (res.data ?? []).map((r) => ({ ...r.attributes, id: r.attributes?.id ?? r.id }));
}

/** Tells Channex the revision is in our books. It then hides the guest's contact details, so save first. */
export async function ackRevision(revisionId: string): Promise<void> {
  await call(`/booking_revisions/${encodeURIComponent(revisionId)}/ack`, { method: "POST" });
}

// ---- Webhook (Channex tells us at once when a booking comes in) -------------------------------

export async function createWebhook(webhook: { propertyId: string; callbackUrl: string; headers: Record<string, string> }): Promise<string> {
  const res = await call<{ data: Resource }>("/webhooks", {
    method: "POST",
    body: {
      webhook: {
        property_id: webhook.propertyId,
        callback_url: webhook.callbackUrl,
        event_mask: "booking",
        request_params: {},
        headers: webhook.headers,
        is_active: true,
        send_data: true,
      },
    },
  });
  return res.data.id;
}

export async function deleteWebhook(id: string): Promise<void> {
  await call(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---- The embedded screen where the owner joins and matches the booking sites ------------------

/** A web address that opens Channex's "channels" screen for this hotel, signed in. Works once, for 15 minutes. */
export async function channelScreenUrl(propertyId: string, username: string): Promise<string> {
  const res = await call<{ data: { token: string } }>("/auth/one_time_token", {
    method: "POST",
    body: { one_time_token: { property_id: propertyId, username: username.slice(0, 100) || "Hotel" } },
  });
  const url = new URL(`${channexServerUrl()}/auth/exchange`);
  url.searchParams.set("oauth_session_key", res.data.token);
  url.searchParams.set("app_mode", "headless");
  url.searchParams.set("redirect_to", "/channels");
  url.searchParams.set("property_id", propertyId);
  return url.toString();
}
