// Several rooms booked together (a family, a wedding party, a company): one booking per room,
// tied together by the same groupId. Pure: no database code, so screens and tests can use it.
import { round2 } from "./pricing";

export interface GroupRoom {
  id: string;
  number: number;
  roomNumber: string;
  roomType: string;
  status: string;
  adults: number;
  children: number;
  total: number;
  paid: number;
  balance: number;
  invoiceNumber: string | null;
}

export interface GroupSummary {
  groupId: string;
  rooms: GroupRoom[];
  adults: number;
  children: number;
  total: number;
  paid: number;
  balance: number;
}

/** Rooms that still count: a cancelled room or one that never came owes nothing. */
const counts = (r: { status?: string }) => r.status !== "cancelled" && r.status !== "no_show";

export function summarizeGroup(groupId: string, rooms: GroupRoom[]): GroupSummary {
  const live = rooms.filter(counts);
  const add = (pick: (r: GroupRoom) => number) => round2(live.reduce((s, r) => s + pick(r), 0));
  return {
    groupId,
    rooms: [...rooms].sort((a, b) => a.number - b.number),
    adults: live.reduce((s, r) => s + r.adults, 0),
    children: live.reduce((s, r) => s + r.children, 0),
    total: add((r) => r.total),
    paid: round2(rooms.reduce((s, r) => s + r.paid, 0)),
    balance: add((r) => Math.max(0, r.balance)),
  };
}

/**
 * Shares one payment for the whole group out over its rooms: each room's balance is paid off in
 * booking order; anything more than the group owes stays on the first room (as an advance, or to
 * give back). Every share is in paise, and the shares always add up to the amount.
 */
export function splitAcross(amount: number, rooms: Array<{ id: string; balance: number; status?: string }>): Array<{ id: string; amount: number }> {
  const open = rooms.filter(counts);
  if (!open.length) return [];
  let left = round2(amount);
  const shares = new Map<string, number>();
  for (const r of open) {
    if (left <= 0) break;
    const take = round2(Math.min(left, Math.max(0, r.balance)));
    if (take <= 0) continue;
    shares.set(r.id, take);
    left = round2(left - take);
  }
  if (left > 0) shares.set(open[0].id, round2((shares.get(open[0].id) ?? 0) + left));
  return open.filter((r) => shares.has(r.id)).map((r) => ({ id: r.id, amount: shares.get(r.id)! }));
}
