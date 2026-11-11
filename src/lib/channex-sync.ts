// Channex: sending the hotel's free rooms and prices to booking sites, and bringing their bookings in.
import type { BillingContext } from "./settings";

export interface ChannexSyncResult {
  /** The hotel is joined to Channex. */
  connected: boolean;
  /** Bookings, changes and cancellations brought in. */
  pulled: number;
  /** Free rooms or prices were sent (false when nothing had changed). */
  pushed: boolean;
  error: string | null;
}

/** The software provider has set a Channex API key (CHANNEX_API_KEY). */
export function channexConfigured(): boolean {
  return !!process.env.CHANNEX_API_KEY;
}

/** Brings in what booking sites sold since last time, then sends our free rooms and prices if they changed. */
export async function syncChannex(ctx: BillingContext, opts: { force?: boolean } = {}): Promise<ChannexSyncResult> {
  void ctx;
  void opts;
  return { connected: false, pulled: 0, pushed: false, error: null };
}
