"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, Loading, PageHeader, Tabs, Tip } from "@/components/ui";
import { BarList } from "@/components/bar-list";
import { TipCard } from "@/components/rate-tips";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { clockLabel } from "@/lib/messages";
import { cn, formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";
import type { RateTipsDTO } from "@/lib/types";

type Days = "30" | "60" | "90";

export default function RateTipsPage() {
  const { isAdmin, toast, settings } = useApp();
  const [days, setDays] = useState<Days>("30");
  const [data, setData] = useState<RateTipsDTO | null>(null);

  const load = useCallback(() => {
    api<RateTipsDTO>(`/api/rate-tips${isAdmin ? `?insights=${days}` : ""}`)
      .then(setData)
      .catch((e) => toast(e.message, "error"));
  }, [isAdmin, days, toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    window.addEventListener("rate-tips-seen", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("rate-tips-seen", load);
    };
  }, [load]);

  if (!data) return <Loading />;
  const ins = data.insights;
  const busiest = ins ? [...ins.slots].sort((a, b) => b.sameDay - a.sameDay)[0] : null;
  const sameDayTotal = ins ? ins.slots.reduce((a, s) => a + s.sameDay, 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate tips"
        description={`Rooms still empty for tonight, and a lower price that may get them sold. Tips start at ${clockLabel(data.from)} and get a little lower as the evening goes on.`}
      />

      {!data.enabled && (
        <Tip tone="warning">
          Rate tips are turned off.{" "}
          {isAdmin ? (
            <Link href="/settings?tab=tips" className="font-semibold underline">
              Turn them on in Settings → Rate tips
            </Link>
          ) : (
            "The owner can turn them on in Settings."
          )}
        </Tip>
      )}
      {data.enabled && !data.visible && <Tip>The owner has chosen to see rate tips themselves. Ask them for tonight&apos;s prices.</Tip>}

      {data.types.length > 0 && (
        <Card>
          <CardHeader title={`Tonight, ${formatDate(data.date)}`} description={data.started ? "Rooms of each type, and a price for the ones that will probably stay empty." : `No tips before ${clockLabel(data.from)}: mornings sell at the usual price.`} />
          <CardContent className="space-y-4">
            {data.types.map((t) => (
              <div key={t.type} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {label(t.type)} <span className="font-normal text-slate-500">· usual price {formatCurrency(t.usualPrice)}</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    <b>{t.sold}</b> sold · <b className={t.free ? "text-amber-700" : "text-emerald-700"}>{t.free}</b> free
                    {t.rooms > t.sellable && <> · {t.rooms - t.sellable} not in use</>}
                  </p>
                </div>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-amber-200" aria-hidden>
                  <div className="bg-emerald-600" style={{ width: `${t.sellable ? (t.sold / t.sellable) * 100 : 0}%` }} />
                </div>
                {t.tip ? (
                  <div className="mt-3">
                    <TipCard tip={t.tip} from={data.from} />
                    {isAdmin && <SeenBy seen={data.seenBy.filter((x) => x.tipKey.startsWith(`${data.date}|${t.type}|`))} timezone={settings.timezone} />}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">{t.note}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ins && (
        <>
          <Tabs
            value={days}
            onChange={setDays}
            tabs={[
              { value: "30", label: "Last 30 days" },
              { value: "60", label: "Last 60 days" },
              { value: "90", label: "Last 90 days" },
            ]}
          />
          <Card>
            <CardHeader title="Room types" description={`How full each type was over ${ins.days} night${ins.days === 1 ? "" : "s"}, and the average price it sold for.`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 text-right font-semibold">Rooms</th>
                    <th className="px-3 py-2 text-right font-semibold">Full</th>
                    <th className="px-3 py-2 text-right font-semibold">Empty room-nights</th>
                    <th className="px-3 py-2 text-right font-semibold">Usual price</th>
                    <th className="px-5 py-2 text-right font-semibold">Sold for (average)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ins.byType.map((t) => (
                    <tr key={t.type}>
                      <td className="px-5 py-2.5 font-semibold">{label(t.type)}</td>
                      <td className="px-3 py-2.5 text-right">{t.rooms}</td>
                      <td className={cn("px-3 py-2.5 text-right font-semibold", t.occupancy < 50 ? "text-amber-700" : "text-emerald-700")}>{t.occupancy}%</td>
                      <td className="px-3 py-2.5 text-right">{t.emptyNights}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(t.listPrice)}</td>
                      <td className="px-5 py-2.5 text-right">{t.averageRate === null ? "–" : formatCurrency(t.averageRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Bookings for the same night"
                description={
                  busiest && busiest.sameDay > 0
                    ? `Guests who book on the day they arrive (walk-ins, calls). Most come ${busiest.label.toLowerCase()}.`
                    : "Guests who book on the day they arrive (walk-ins, calls)."
                }
              />
              <CardContent>
                <BarList data={ins.slots.map((s) => ({ key: s.label, value: s.sameDay }))} format={(n) => String(n)} empty="No same-day bookings yet" inOrder />
                {sameDayTotal > 0 && <p className="mt-3 text-xs text-slate-500">{sameDayTotal} same-day bookings in all.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="All bookings by time of day" description="When bookings were made, for any date." />
              <CardContent>
                <BarList data={ins.slots.map((s) => ({ key: s.label, value: s.all }))} format={(n) => String(n)} tone="amber" empty="No bookings yet" inOrder />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function SeenBy({ seen, timezone }: { seen: RateTipsDTO["seenBy"]; timezone: string }) {
  if (!seen.length) return <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Lightbulb className="h-3.5 w-3.5" /> Nobody has confirmed this tip yet.</p>;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      {seen.map((x) => (
        <span key={x.tipKey + x.staffName} className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {x.staffName} saw {formatCurrency(Number(x.tipKey.split("|")[2]))}, {formatDateTime(x.createdAt, timezone).split(", ").pop()}
        </span>
      ))}
    </p>
  );
}
