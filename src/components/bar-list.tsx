"use client";

import { formatCurrency, label } from "@/lib/utils";

/** Horizontal bars for a breakdown, sorted largest first. One hue: the label carries identity. */
export function BarList({
  data,
  format = formatCurrency,
  empty = "No data",
  tone = "primary",
}: {
  data: Array<{ key: string; value: number; sub?: string }>;
  format?: (n: number) => string;
  empty?: string;
  tone?: "primary" | "amber";
}) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  if (data.length === 0) return <p className="py-4 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {[...data]
        .sort((a, b) => b.value - a.value)
        .map((d) => (
          <li key={d.key}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">
                {label(d.key)} {d.sub && <span className="text-xs text-slate-500">· {d.sub}</span>}
              </span>
              <span className="shrink-0 font-semibold text-slate-900">{format(d.value)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
              <div
                className={tone === "amber" ? "h-2.5 rounded-full bg-amber-500" : "h-2.5 rounded-full bg-primary-600"}
                style={{ width: `${Math.max(2, (Math.abs(d.value) / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
    </ul>
  );
}
