"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Input, Tabs } from "@/components/ui";
import { periodLabel, periodRange, shiftPeriod, type PeriodKind } from "@/lib/periods";

export type PeriodValue = { kind: PeriodKind | "custom"; from: string; to: string };

const CURRENT: Record<PeriodKind, string> = { day: "Today", week: "This week", month: "This month", year: "This year" };

export function periodFor(kind: PeriodKind, anchor: string): PeriodValue {
  return { kind, ...periodRange(kind, anchor) };
}

/** Pick a day, week, month or year and step back and forth, or choose any two dates. */
export function PeriodPicker({
  value,
  onChange,
  today,
  kinds = ["day", "week", "month", "year"],
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  today: string;
  kinds?: PeriodKind[];
}) {
  const kind = value.kind;
  const isCurrent = kind !== "custom" && value.from <= today && today <= value.to;
  const names: Record<PeriodKind, string> = { day: "Day", week: "Week", month: "Month", year: "Year" };

  return (
    <div className="space-y-3">
      <Tabs
        value={kind}
        onChange={(k) => onChange(k === "custom" ? { kind: "custom", from: value.from, to: value.to } : periodFor(k, today))}
        tabs={[...kinds.map((k) => ({ value: k as PeriodValue["kind"], label: names[k] })), { value: "custom", label: "Choose dates" }]}
      />
      {kind === "custom" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} className="w-auto" aria-label="From" />
          <span className="text-slate-500">to</span>
          <Input type="date" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} className="w-auto" aria-label="To" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => onChange(periodFor(kind, shiftPeriod(kind, value.from, -1)))} aria-label={`Previous ${kind}`}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="min-w-0 px-1 text-lg font-bold text-slate-900">{periodLabel(kind, value.from, value.to)}</p>
          <Button variant="outline" onClick={() => onChange(periodFor(kind, shiftPeriod(kind, value.from, 1)))} aria-label={`Next ${kind}`}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          {!isCurrent && (
            <Button variant="ghost" onClick={() => onChange(periodFor(kind, today))}>
              {CURRENT[kind]}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
