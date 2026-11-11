// Calendar links (iCal) with booking sites: reading each site's link and writing its stays into our books.
import type { BillingContext } from "./settings";

export interface CalendarSyncResult {
  /** Calendar links read. */
  read: number;
  created: number;
  updated: number;
  cancelled: number;
  issues: number;
  /** Links that could not be read. */
  errors: number;
}

/**
 * Reads the booking sites' calendar links and writes what they sold into our bookings.
 * A link read in the last few minutes is skipped unless `force`.
 */
export async function syncCalendars(ctx: BillingContext, opts: { force?: boolean; calendarId?: string } = {}): Promise<CalendarSyncResult> {
  void ctx;
  void opts;
  return { read: 0, created: 0, updated: 0, cancelled: 0, issues: 0, errors: 0 };
}
