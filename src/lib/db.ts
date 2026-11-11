import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

/**
 * Sees every hotel's data. Only for sign-in, the public booking token lookup
 * and the software provider's /platform panel — never for a hotel's own screens.
 */
export const rawPrisma = base;

const hotelContext = new AsyncLocalStorage<{ hotelId: string }>();

/** Runs `fn` with every `prisma` query limited to one hotel's data. */
export function runForHotel<T>(hotelId: string, fn: () => T): T {
  return hotelContext.run({ hotelId }, () => {
    const result = fn();
    // Prisma queries are lazy and only run when awaited. Start them now, while
    // the hotel is still selected, so `runForHotel(id, () => prisma.x.find())` works.
    if (result && typeof (result as { then?: unknown }).then === "function") {
      return Promise.resolve(result) as T;
    }
    return result;
  });
}

export function currentHotelId(): string {
  const context = hotelContext.getStore();
  if (!context) throw new Error("No hotel selected: hotel data can only be read inside runForHotel()");
  return context.hotelId;
}

/** Tables whose rows belong to a single hotel. */
const HOTEL_MODELS = new Set([
  "Staff",
  "HotelSettings",
  "SeasonalRate",
  "Room",
  "Guest",
  "Booking",
  "Charge",
  "Payment",
  "Bill",
  "ActivityLog",
  "Expense",
  "Shift",
  "ShiftTransfer",
  "GuestForm",
  "IdCheck",
  "RateTipSeen",
  "PaymentLink",
  "ChannelCalendar",
  "ChannelIssue",
  "ChannexLink",
  "Company",
  "MenuItem",
]);

/** Writes that change which rooms are free or what they cost: booking sites must hear of them. */
const WATCHED: Record<string, Set<string>> = {
  Booking: new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert", "delete", "deleteMany"]),
  Room: new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert", "delete", "deleteMany"]),
  SeasonalRate: new Set(["create", "createMany", "update", "updateMany", "delete", "deleteMany"]),
  // Not "upsert": the settings row is upserted on every request just to make sure it exists.
  HotelSettings: new Set(["update"]),
};

function changesWhatIsFree(model: string, operation: string) {
  return WATCHED[model]?.has(operation) ?? false;
}

/**
 * After a booking, a room or a price changes, the hotel's free rooms and prices are sent to its
 * booking sites (src/lib/channel-push.ts), once the request has answered. Loaded only when needed,
 * because that file itself uses this one.
 */
function tellBookingSites(hotelId: string) {
  if (!process.env.CHANNEX_API_KEY) return;
  void import("./channel-push").then((m) => m.scheduleChannelPush(hotelId)).catch((error) => console.error("Could not plan the update to booking sites", error));
}

type Args = Record<string, unknown> & { where?: object; data?: unknown; create?: object };

export function scopeArgs(operation: string, args: Args | undefined, hotelId: string): Args {
  const a: Args = { ...(args ?? {}) };
  switch (operation) {
    case "create":
      a.data = { ...(a.data as object), hotelId };
      break;
    case "createMany":
    case "createManyAndReturn":
      a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: object) => ({ ...d, hotelId }));
      break;
    case "upsert":
      a.where = { ...a.where, hotelId };
      a.create = { ...a.create, hotelId };
      break;
    default:
      // Reads, counts, updates and deletes: only ever touch this hotel's rows.
      a.where = { ...a.where, hotelId };
  }
  return a;
}

/**
 * The database client for a hotel's own screens. Every query on a hotel table is
 * filtered to the hotel of the current request, and new rows are stamped with it.
 * Using it outside runForHotel() throws, so a missed check fails loudly instead
 * of showing one hotel another hotel's data.
 */
export const prisma = base.$extends({
  name: "hotel-scope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!HOTEL_MODELS.has(model)) return query(args);
        const hotelId = currentHotelId();
        const result = await query(scopeArgs(operation, args as Args, hotelId) as typeof args);
        if (changesWhatIsFree(model, operation)) tellBookingSites(hotelId);
        return result;
      },
    },
  },
});

/** Either the hotel client or a transaction opened on it. */
export type Db = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
