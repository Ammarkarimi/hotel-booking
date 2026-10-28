"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BedDouble, Download, IndianRupee, Percent, PiggyBank, Printer, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, EmptyState, Loading, PageHeader, Row, StatCard, Tabs, Tip } from "@/components/ui";
import { BarList } from "@/components/bar-list";
import { PeriodPicker, periodFor, type PeriodValue } from "@/components/period-picker";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { defaultGroupBy, periodLabel, type GroupBy } from "@/lib/periods";
import type { Report } from "@/lib/reports";
import { cn, formatCurrency, formatDate, label } from "@/lib/utils";

const CHART_BLUE = "#2548eb";
const CHART_AMBER = "#f59e0b";

const money = (n: number) => formatCurrency(Math.round(n));
const shortMoney = (v: number) => (Math.abs(v) >= 100000 ? `${Math.round(v / 1000) / 100}L` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

/** Which "show each" choices make sense for a period of this many days. */
function groupChoices(days: number): GroupBy[] {
  if (days <= 1) return [];
  if (days <= 7) return ["day"];
  if (days <= 62) return ["day", "week"];
  return ["week", "month"];
}

export default function ReportsPage() {
  const { settings, isAdmin } = useApp();
  const [period, setPeriod] = useState<PeriodValue>(() => periodFor("month", settings.today));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => defaultGroupBy(period.from, period.to));
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [includeUpcoming, setIncludeUpcoming] = useState(false);

  // The current week, month or year is shown up to today, so days that have not happened yet
  // do not pull down the averages. The owner can add the upcoming days to see bookings already made.
  const today = settings.today;
  const runsPastToday = period.kind !== "custom" && period.from <= today && today < period.to;
  const to = runsPastToday && !includeUpcoming ? today : period.to;
  const dayCount = Math.round((Date.parse(to) - Date.parse(period.from)) / 86400000) + 1;
  const choices = groupChoices(dayCount);
  const effectiveGroup = choices.includes(groupBy) ? groupBy : choices[0] ?? "day";

  useEffect(() => {
    if (!period.from || !to || to < period.from) return;
    setData(null);
    setError("");
    api<Report>(`/api/reports?from=${period.from}&to=${to}&groupBy=${effectiveGroup}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [period.from, to, effectiveGroup]);

  if (!isAdmin) return <EmptyState title="Reports are for the owner / manager" description="Ask the hotel owner if you need this information." />;

  const query = `from=${period.from}&to=${to}&groupBy=${effectiveGroup}`;
  const download = (type: string) => window.open(`/api/reports/export?type=${type}&${query}`, "_blank");
  const t = data?.totals;
  const title = `${periodLabel(period.kind, period.from, period.to)}${to < period.to ? " (so far)" : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="How your hotel is doing for any day, week, month or year. Amounts are before GST."
        actions={
          <Button variant="outline" onClick={() => window.print()} className="no-print">
            <Printer className="h-4 w-4" /> Print / save PDF
          </Button>
        }
      />

      <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PeriodPicker
          value={period}
          onChange={(v) => {
            setPeriod(v);
            setGroupBy(defaultGroupBy(v.from, v.to));
            setIncludeUpcoming(false);
          }}
          today={settings.today}
        />
        {choices.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">Show each</span>
            <Tabs value={effectiveGroup} onChange={setGroupBy} tabs={choices.map((c) => ({ value: c, label: label(c) }))} />
          </div>
        )}
      </div>
      {runsPastToday && (
        <p className="no-print text-sm text-slate-600">
          {includeUpcoming ? `Showing all of this ${period.kind}, including bookings already made for the coming days.` : `Showing ${formatDate(period.from)} to today.`}{" "}
          <button type="button" onClick={() => setIncludeUpcoming((v) => !v)} className="font-semibold text-primary-700 hover:underline">
            {includeUpcoming ? "Show up to today only" : `Include the rest of this ${period.kind}`}
          </button>
        </p>
      )}
      <p className="hidden text-lg font-bold print:block">
        {settings.hotelName} · {title}
      </p>

      {error && <Tip tone="danger">{error}</Tip>}
      {!data || !t ? (
        !error && <Loading text="Preparing your report..." />
      ) : (
        <>
          {data.from > settings.today && (
            <Tip>This period is in the future, so these numbers show bookings made so far. Expenses and payments will appear as they happen.</Tip>
          )}

          {/* Profit */}
          <Card>
            <CardHeader title={`Profit · ${title}`} description="What the hotel earned, minus what it spent. Before GST." />
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div>
                <Row label="Room earnings">{money(t.roomRevenue)}</Row>
                <Row label="Food, laundry & other extras">{money(t.extrasRevenue)}</Row>
                <Row label="Total earnings" strong>
                  {money(t.revenue)}
                </Row>
                <Row label={<Link href="/expenses" className="text-primary-700 hover:underline">Expenses</Link>}>− {money(t.expenses)}</Row>
                {t.otaFees > 0 && <Row label="Booking site commission & fees">− {money(t.otaFees)}</Row>}
                <div className={cn("mt-2 flex items-center justify-between rounded-xl px-4 py-3 text-lg font-bold", t.profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                  <span>{t.profit >= 0 ? "Profit" : "Loss"}</span>
                  <span>{money(Math.abs(t.profit))}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 self-start">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Profit margin</p>
                  <p className={cn("text-xl font-bold", t.margin >= 0 ? "text-slate-900" : "text-red-600")}>{t.margin}%</p>
                  <p className="text-xs text-slate-500">of total earnings kept</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Money received</p>
                  <p className="text-xl font-bold text-slate-900">{money(t.collected)}</p>
                  <p className="text-xs text-slate-500">{t.refunds ? `after ${money(t.refunds)} refunds` : "payments from guests"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Money spent</p>
                  <p className="text-xl font-bold text-slate-900">{money(t.moneyOut)}</p>
                  <p className="text-xs text-slate-500">expenses paid</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Money owed to you</p>
                  <p className={cn("text-xl font-bold", t.outstanding > 0 ? "text-red-600" : "text-slate-900")}>{money(t.outstanding)}</p>
                  <p className="text-xs text-slate-500">all unpaid bills</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-room numbers */}
          <div>
            <h2 className="mb-3 text-lg font-bold">
              Rooms · {data.rooms} room{data.rooms === 1 ? "" : "s"}
              {data.roomsUnderRepair > 0 && <span className="text-base font-semibold text-slate-500"> · {data.roomsUnderRepair} under repair, not counted from today</span>}
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="How full (occupancy)" value={`${t.occupancy}%`} subtitle={`${t.roomNightsSold} of ${t.availableRoomNights} room-nights sold`} icon={<Percent className="h-5 w-5" />} tone="sky" />
              <StatCard title="Average price per room sold" value={money(t.adr)} subtitle="ADR: room earnings ÷ rooms sold" icon={<IndianRupee className="h-5 w-5" />} tone="slate" />
              <StatCard title="Earnings per available room" value={money(t.revpar)} subtitle={`RevPAR: room earnings ÷ all ${data.rooms} rooms, sold or not`} icon={<TrendingUp className="h-5 w-5" />} />
              <StatCard title="All earnings per available room" value={money(t.trevpar)} subtitle="TRevPAR: rooms + extras ÷ all rooms" icon={<BedDouble className="h-5 w-5" />} tone="slate" />
              <StatCard title="Cost per available room" value={money(t.costPerAvailableRoom)} subtitle={`Costs ÷ all ${data.rooms} rooms, each night`} icon={<Receipt className="h-5 w-5" />} tone="amber" />
              <StatCard title="Cost per room sold" value={money(t.costPerOccupiedRoom)} subtitle="Costs ÷ rooms sold" icon={<Receipt className="h-5 w-5" />} tone="amber" />
              <StatCard
                title="Profit per available room"
                value={money(t.profitPerAvailableRoom)}
                subtitle="GOPPAR: profit ÷ all rooms, each night"
                icon={t.profitPerAvailableRoom >= 0 ? <PiggyBank className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                tone={t.profitPerAvailableRoom >= 0 ? "green" : "red"}
              />
              <StatCard title="Money received" value={money(t.collected)} subtitle="Cash, UPI, card, bank" icon={<Wallet className="h-5 w-5" />} tone="green" />
            </div>
            <details className="no-print mt-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[15px] text-slate-700">
              <summary className="cursor-pointer font-semibold text-primary-700">What do these numbers mean?</summary>
              <div className="mt-3 space-y-2">
                <p>
                  You have <b>{data.rooms} rooms</b>
                  {data.roomsUnderRepair > 0 && ` (${data.roomsUnderRepair} under repair, so not for sale from today)`}. Over {data.days} night{data.days === 1 ? "" : "s"} you could sell <b>{t.availableRoomNights}</b> room-nights and you sold{" "}
                  <b>{t.roomNightsSold}</b>, earning <b>{money(t.roomRevenue)}</b> from rooms.
                </p>
                <p>
                  <b>Average price per room sold (ADR)</b> counts only the rooms sold: {money(t.roomRevenue)} ÷ {t.roomNightsSold} = <b>{money(t.adr)}</b>.
                </p>
                <p>
                  <b>Earnings per available room (RevPAR)</b> counts every room, sold or empty: {money(t.roomRevenue)} ÷ {t.availableRoomNights} = <b>{money(t.revpar)}</b>. It
                  shows how well the whole hotel earns. Empty rooms pull it down.
                </p>
                <p>
                  <b>Cost per available room</b> is what each room costs you to run per night: your costs (expenses plus booking-site commission) {money(t.costs)} ÷ {t.availableRoomNights} = <b>{money(t.costPerAvailableRoom)}</b>. If
                  it is higher than the earnings per available room, the hotel is losing money.
                </p>
              </div>
            </details>
          </div>

          {/* Charts and the breakdown table */}
          {data.groups.length > 1 && (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader title="Earnings and expenses" description={`Each ${effectiveGroup}, before GST`} />
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.groups} margin={{ left: 0, right: 8, top: 8 }}>
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} minTickGap={12} />
                        <YAxis tickFormatter={shortMoney} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v, name) => [money(Number(v)), name]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="revenue" name="Earnings" fill={CHART_BLUE} radius={[4, 4, 0, 0]} maxBarSize={24} />
                        <Bar dataKey="costs" name="Costs" fill={CHART_AMBER} radius={[4, 4, 0, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="How full each night" description={`Occupancy each ${effectiveGroup}`} />
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.groups} margin={{ left: -20, right: 8, top: 8 }}>
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} minTickGap={12} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                        <Tooltip
                          cursor={{ fill: "#f1f5f9" }}
                          formatter={(v, _n, item) => {
                            const g = item.payload as { roomsSold: number; roomsAvailable: number };
                            return [`${v}% (${g.roomsSold} of ${g.roomsAvailable} room-nights)`, "Occupancy"];
                          }}
                        />
                        <Bar dataKey="occupancy" fill={CHART_BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-x-auto">
                <CardHeader title={`${label(effectiveGroup)} by ${effectiveGroup}`} description="Swipe sideways on a phone to see every column." />
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">{label(effectiveGroup)}</th>
                      <th className="px-3 py-2 text-right">Rooms sold</th>
                      <th className="px-3 py-2 text-right">Full</th>
                      <th className="px-3 py-2 text-right">ADR</th>
                      <th className="px-3 py-2 text-right">RevPAR</th>
                      <th className="px-3 py-2 text-right">Earnings</th>
                      <th className="px-3 py-2 text-right">Costs</th>
                      <th className="px-3 py-2 text-right">Profit</th>
                      <th className="px-3 py-2 text-right">Cost / room</th>
                      <th className="px-3 py-2 text-right">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.groups.map((g) => (
                      <tr key={g.key}>
                        <td className="whitespace-nowrap px-4 py-2 font-medium">{g.label}</td>
                        <td className="px-3 py-2 text-right">
                          {g.roomsSold} <span className="text-xs text-slate-400">/ {g.roomsAvailable}</span>
                        </td>
                        <td className="px-3 py-2 text-right">{g.occupancy}%</td>
                        <td className="px-3 py-2 text-right">{money(g.adr)}</td>
                        <td className="px-3 py-2 text-right">{money(g.revpar)}</td>
                        <td className="px-3 py-2 text-right">{money(g.revenue)}</td>
                        <td className="px-3 py-2 text-right">{money(g.costs)}</td>
                        <td className={cn("px-3 py-2 text-right font-semibold", g.profit < 0 && "text-red-600")}>{money(g.profit)}</td>
                        <td className="px-3 py-2 text-right">{money(g.costPerAvailableRoom)}</td>
                        <td className="px-3 py-2 text-right">{money(g.collected)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-3 py-2 text-right">
                        {t.roomNightsSold} <span className="text-xs font-normal text-slate-400">/ {t.availableRoomNights}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{t.occupancy}%</td>
                      <td className="px-3 py-2 text-right">{money(t.adr)}</td>
                      <td className="px-3 py-2 text-right">{money(t.revpar)}</td>
                      <td className="px-3 py-2 text-right">{money(t.revenue)}</td>
                      <td className="px-3 py-2 text-right">{money(t.costs)}</td>
                      <td className={cn("px-3 py-2 text-right", t.profit < 0 && "text-red-600")}>{money(t.profit)}</td>
                      <td className="px-3 py-2 text-right">{money(t.costPerAvailableRoom)}</td>
                      <td className="px-3 py-2 text-right">{money(t.collected)}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {/* Room types and sources */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-x-auto">
              <CardHeader title="Room types" description="How each kind of room is selling" />
              {data.byRoomType.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-slate-500">No rooms yet.</p>
              ) : (
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-3 py-2 text-right">Nights sold</th>
                      <th className="px-3 py-2 text-right">Full</th>
                      <th className="px-3 py-2 text-right">ADR</th>
                      <th className="px-3 py-2 text-right">RevPAR</th>
                      <th className="px-3 py-2 text-right">Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byRoomType.map((r) => (
                      <tr key={r.type}>
                        <td className="px-4 py-2 font-medium">
                          {label(r.type)} <span className="text-xs text-slate-400">· {r.rooms}</span>
                        </td>
                        <td className="px-3 py-2 text-right">{r.nights}</td>
                        <td className="px-3 py-2 text-right">{r.occupancy}%</td>
                        <td className="px-3 py-2 text-right">{money(r.adr)}</td>
                        <td className="px-3 py-2 text-right">{money(r.revpar)}</td>
                        <td className="px-3 py-2 text-right">{money(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card>
              <CardHeader title="Where bookings came from" description="Room earnings by source" />
              <CardContent>
                <BarList
                  data={Object.entries(data.bySource).map(([k, v]) => ({
                    key: k,
                    value: v.revenue,
                    sub: `${v.bookings} booking${v.bookings > 1 ? "s" : ""}, ${v.nights} night${v.nights > 1 ? "s" : ""}`,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          {/* Booking-site payouts */}
          {data.payouts.totals.bookings > 0 && (
            <Card className="overflow-x-auto">
              <CardHeader
                title="Booking site payouts"
                description="Stays from booking sites that end in this period. Your bill stays on the full (gross) amount; this is what the sites actually pay you."
              />
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">Bills (gross)</p>
                    <p className="text-xl font-bold">{money(data.payouts.totals.gross)}</p>
                    <p className="text-xs text-slate-500">{data.payouts.totals.bookings} stay{data.payouts.totals.bookings === 1 ? "" : "s"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">Commission & fees</p>
                    <p className="text-xl font-bold text-amber-700">− {money(data.payouts.totals.fees)}</p>
                    <p className="text-xs text-slate-500">counted in your costs</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">TCS + TDS kept by sites</p>
                    <p className="text-xl font-bold">{money(data.payouts.totals.taxHeld)}</p>
                    <p className="text-xs text-slate-500">you can claim this back</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">Sites pay you</p>
                    <p className="text-xl font-bold text-emerald-700">{money(data.payouts.totals.net)}</p>
                    <p className="text-xs text-slate-500">
                      {money(data.payouts.totals.received)} received · {money(data.payouts.totals.waiting)} waiting
                    </p>
                  </div>
                </div>
                {data.payouts.totals.entered < data.payouts.totals.bookings && (
                  <Tip tone="warning">
                    {data.payouts.totals.bookings - data.payouts.totals.entered} stay{data.payouts.totals.bookings - data.payouts.totals.entered === 1 ? " has" : "s have"} no payout entered yet. Open the
                    booking and fill in “Booking site payout” from the site&apos;s statement.
                  </Tip>
                )}
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Site</th>
                      <th className="px-3 py-2 text-right">Stays</th>
                      <th className="px-3 py-2 text-right">Gross</th>
                      <th className="px-3 py-2 text-right">Commission</th>
                      <th className="px-3 py-2 text-right">TCS + TDS</th>
                      <th className="px-3 py-2 text-right">Pays you</th>
                      <th className="px-3 py-2 text-right">Waiting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.payouts.bySite.map((r) => (
                      <tr key={r.site}>
                        <td className="px-3 py-2 font-medium">{label(r.site)}</td>
                        <td className="px-3 py-2 text-right">
                          {r.bookings}
                          {r.entered < r.bookings && <span className="text-xs text-amber-700"> ({r.bookings - r.entered} not entered)</span>}
                        </td>
                        <td className="px-3 py-2 text-right">{money(r.gross)}</td>
                        <td className="px-3 py-2 text-right">{money(r.fees)}</td>
                        <td className="px-3 py-2 text-right">{money(r.taxHeld)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{money(r.net)}</td>
                        <td className={cn("px-3 py-2 text-right", r.waiting > 0 && "text-amber-700")}>{money(r.waiting)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <details className="no-print rounded-xl border border-slate-200">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary-700">Show each stay ({data.payouts.rows.length})</summary>
                  <ul className="divide-y divide-slate-100">
                    {data.payouts.rows.map((r) => (
                      <li key={r.bookingId}>
                        <Link href={`/bookings/${r.bookingId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              #{r.number} · {r.guestName} · {label(r.source)}
                              {r.otaReference && <span className="font-normal text-slate-500"> · {r.otaReference}</span>}
                            </span>
                            <span className="block text-xs text-slate-500">
                              Leaving {formatDate(r.checkOut)} · gross {formatCurrency(r.gross)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            {r.net === null ? (
                              <span className="text-xs font-semibold text-amber-700">Not entered</span>
                            ) : (
                              <>
                                <span className="block font-semibold">{formatCurrency(r.net)}</span>
                                <span className={cn("block text-xs", r.received ? "text-emerald-700" : "text-amber-700")}>
                                  {r.received ? `Received ${formatDate(r.receivedOn!)}` : "Waiting"}
                                </span>
                              </>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </CardContent>
            </Card>
          )}

          {/* Expenses and money in / out */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader
                title="Expenses by kind"
                action={
                  <Link href="/expenses" className="no-print text-sm font-semibold text-primary-600 hover:underline">
                    Add / see all
                  </Link>
                }
              />
              <CardContent>
                <BarList tone="amber" data={Object.entries(data.expensesByCategory).map(([key, value]) => ({ key, value }))} empty="No expenses written down" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Money in and out" description="Actual payments and spending" />
              <CardContent>
                {Object.entries(data.byMethod)
                  .filter(([m]) => m !== "ota")
                  .map(([m, v]) => (
                    <Row key={m} label={`Received by ${label(m)}`}>
                      {money(v)}
                    </Row>
                  ))}
                {(t.payoutsReceived > 0 || t.prepaidOnSites > 0) && <Row label="Paid into your bank by booking sites">{money(t.payoutsReceived)}</Row>}
                <Row label="Total received" strong>
                  {money(t.collectedAtHotel + t.payoutsReceived)}
                </Row>
                <Row label="Expenses paid">− {money(t.moneyOut)}</Row>
                <Row label="Money left" strong>
                  <span className={t.netCash < 0 ? "text-red-600" : ""}>{money(t.netCash)}</span>
                </Row>
                <p className="mt-2 text-xs text-slate-500">Cash only: {money(t.cashInDrawer)} (cash received minus cash expenses).</p>
                {t.prepaidOnSites > 0 && (
                  <p className="mt-1 text-xs text-slate-500">Guests also prepaid {money(t.prepaidOnSites)} on booking sites. That money reaches you through the sites&apos; payouts.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Guests and bookings" />
              <CardContent>
                <Row label="Guests arriving">{data.guests.arrivals}</Row>
                <Row label="Guests leaving">{data.guests.departures}</Row>
                <Row label="People (adults + children)">{data.guests.guests}</Row>
                <Row label="Average stay">
                  {data.guests.averageStay} night{data.guests.averageStay === 1 ? "" : "s"}
                </Row>
                <Row label="New bookings made">{data.guests.bookingsMade}</Row>
                <Row label="Cancelled">{data.guests.cancelled}</Row>
                <Row label="Did not come">{data.guests.noShows}</Row>
                <Row label="Cancelled or did not come">{data.guests.cancellationRate}%</Row>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Extras sold" description="Food, laundry and other items added to bills" />
              <CardContent>
                <BarList data={Object.entries(data.extrasByCategory).map(([k, v]) => ({ key: k, value: v }))} empty="No extras" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Tax (GST) summary" description={`${data.tax.invoices} final invoice(s) in this period`} />
              <CardContent>
                <Row label="Taxable value">{formatCurrency(data.tax.taxable)}</Row>
                <Row label="CGST (half)">{formatCurrency(data.tax.total / 2)}</Row>
                <Row label="SGST (half)">{formatCurrency(data.tax.total / 2)}</Row>
                <Row label="Total tax" strong>
                  {formatCurrency(data.tax.total)}
                </Row>
                <Row label="Invoice total">{formatCurrency(data.tax.invoiced)}</Row>
                <p className="mt-2 text-xs text-slate-500">For guests from another state, the same total is IGST. Please confirm filings with your accountant.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="no-print">
            <CardHeader title="Download for Excel / accountant" description="Files open in Excel, Google Sheets or any spreadsheet app." />
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Button variant="outline" onClick={() => download("summary")}>
                <Download className="h-4 w-4" /> Summary {data.groups.length > 1 ? `by ${effectiveGroup}` : ""}
              </Button>
              <Button variant="outline" onClick={() => download("expenses")}>
                <Download className="h-4 w-4" /> Expenses
              </Button>
              <Button variant="outline" onClick={() => download("bookings")}>
                <Download className="h-4 w-4" /> Bookings
              </Button>
              <Button variant="outline" onClick={() => download("payments")}>
                <Download className="h-4 w-4" /> Payments
              </Button>
              <Button variant="outline" onClick={() => download("invoices")}>
                <Download className="h-4 w-4" /> GST invoices
              </Button>
              <Button variant="outline" onClick={() => download("roomtypes")}>
                <Download className="h-4 w-4" /> Room types
              </Button>
              <Button variant="outline" onClick={() => download("payouts")}>
                <Download className="h-4 w-4" /> Booking site payouts
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={`Guests who still owe money (${data.outstanding.length})`} description="Includes guests staying now and guests who already left." />
            {data.outstanding.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">Nobody owes money. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.outstanding.map((o) => (
                  <li key={o.id}>
                    <Link href={`/bookings/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <span>
                        <span className="block font-semibold">
                          {o.guestName} · Room {o.room}
                        </span>
                        <span className="block text-xs text-slate-500">
                          #{o.number} · {o.phone} · {label(o.status)} · leaving {formatDate(o.checkOut)}
                        </span>
                      </span>
                      <span className="font-bold text-red-600">{formatCurrency(o.balance)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
