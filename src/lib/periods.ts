// Report periods (a day, a week, a month or a year) as "YYYY-MM-DD" date keys.
// Weeks run Monday to Sunday.
import { addDays, dateFromKey, diffDays, formatDateKey } from "./dates";

export type PeriodKind = "day" | "week" | "month" | "year";
export type GroupBy = "day" | "week" | "month";

export function weekStart(key: string): string {
  const weekday = dateFromKey(key).getUTCDay(); // 0 = Sunday
  return addDays(key, -((weekday + 6) % 7));
}

export function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** The first day of the month `months` after the month of `key`. */
export function addMonths(key: string, months: number): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + months;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export function monthEnd(key: string): string {
  return addDays(addMonths(key, 1), -1);
}

/** First and last day of the period that contains `anchor`. */
export function periodRange(kind: PeriodKind, anchor: string): { from: string; to: string } {
  switch (kind) {
    case "day":
      return { from: anchor, to: anchor };
    case "week": {
      const from = weekStart(anchor);
      return { from, to: addDays(from, 6) };
    }
    case "month":
      return { from: monthStart(anchor), to: monthEnd(anchor) };
    case "year":
      return { from: `${anchor.slice(0, 4)}-01-01`, to: `${anchor.slice(0, 4)}-12-31` };
  }
}

/** A day inside the previous (step -1) or next (step 1) period. */
export function shiftPeriod(kind: PeriodKind, anchor: string, step: number): string {
  switch (kind) {
    case "day":
      return addDays(anchor, step);
    case "week":
      return addDays(anchor, 7 * step);
    case "month":
      return addMonths(anchor, step);
    case "year":
      return `${Number(anchor.slice(0, 4)) + step}-01-01`;
  }
}

function weekday(key: string): string {
  return formatDateKey(key, { weekday: "short", day: undefined, month: undefined, year: undefined });
}

/** "Tue, 27 Oct 2026", "26 Oct – 1 Nov 2026", "October 2026", "2026", or a plain range. */
export function periodLabel(kind: PeriodKind | "custom", from: string, to: string): string {
  if (kind === "day") return `${weekday(from)}, ${formatDateKey(from)}`;
  if (kind === "month") return formatDateKey(from, { day: undefined, month: "long" });
  if (kind === "year") return from.slice(0, 4);
  if (from === to) return formatDateKey(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDateKey(from, sameYear ? { year: undefined } : {})} – ${formatDateKey(to)}`;
}

/** The group (day, week or month) a day belongs to, named by its first day. */
export function groupKey(day: string, by: GroupBy): string {
  if (by === "week") return weekStart(day);
  if (by === "month") return monthStart(day);
  return day;
}

export function groupLabel(key: string, by: GroupBy): string {
  if (by === "week") return `Week of ${formatDateKey(key, { year: undefined })}`;
  if (by === "month") return formatDateKey(key, { day: undefined, month: "short" });
  return `${weekday(key)}, ${formatDateKey(key, { year: undefined })}`;
}

/** Day rows for up to a month, weeks up to about four months, then months. */
export function defaultGroupBy(from: string, to: string): GroupBy {
  const days = diffDays(from, to) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}
