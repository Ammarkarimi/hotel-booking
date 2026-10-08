"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BedDouble, Download, IndianRupee, Percent, TrendingUp, Wallet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, EmptyState, Input, Loading, PageHeader, Row, StatCard, Tabs, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { formatCurrency, formatDate, label } from "@/lib/utils";

interface Report {
  from: string;
  to: string;
  days: number;
  totals: {
    occupancy: number;
    roomNightsSold: number;
    availableRoomNights: number;
    roomRevenue: number;
    adr: number;
    revpar: number;
    extrasRevenue: number;
    collected: number;
    refunds: number;
    bookings: number;
    cancelled: number;
    noShows: number;
    outstanding: number;
  };
  series: Array<{ date: string; roomsSold: number; occupancy: number; roomRevenue: number; collected: number }>;
  bySource: Record<string, { bookings: number; nights: number; revenue: number }>;
  byRoomType: Record<string, { nights: number; revenue: number }>;
  byMethod: Record<string, number>;
  extrasByCategory: Record<string, number>;
  tax: { invoices: number; taxable: number; roomTax: number; extrasTax: number; total: number; invoiced: number };
  outstanding: Array<{ id: string; number: number; guestName: string; phone: string; room: string; checkOut: string; balance: number; status: string }>;
}

type Period = "7" | "30" | "month" | "lastmonth" | "year" | "custom";

const CHART_BLUE = "#2548eb";
const CHART_GREEN = "#059669";

/** Horizontal bars for a breakdown, sorted largest first. One hue: the label carries identity. */
function BarList({ data, format = formatCurrency, empty = "No data" }: { data: Array<{ key: string; value: number; sub?: string }>; format?: (n: number) => string; empty?: string }) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  if (data.length === 0) return <p className="py-4 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {data
        .sort((a, b) => b.value - a.value)
        .map((d) => (
          <li key={d.key}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-slate-700">
                {label(d.key)} {d.sub && <span className="text-xs text-slate-500">· {d.sub}</span>}
              </span>
              <span className="font-semibold text-slate-900">{format(d.value)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full bg-primary-600" style={{ width: `${Math.max(2, (Math.abs(d.value) / max) * 100)}%` }} />
            </div>
          </li>
        ))}
    </ul>
  );
}

function shortDate(key: string) {
  return formatDate(key).replace(/ \d{4}$/, "");
}

export default function ReportsPage() {
  const { settings, isAdmin } = useApp();
  const today = settings.today;
  const [period, setPeriod] = useState<Period>("30");
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    const lastMonthStart = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    const ranges: Record<Exclude<Period, "custom">, [string, string]> = {
      "7": [addDays(today, -6), today],
      "30": [addDays(today, -29), today],
      month: [`${today.slice(0, 7)}-01`, today],
      lastmonth: [lastMonthStart, addDays(`${today.slice(0, 7)}-01`, -1)],
      year: [`${y}-01-01`, today],
    };
    if (period !== "custom") {
      setFrom(ranges[period][0]);
      setTo(ranges[period][1]);
    }
  }, [period, today]);

  useEffect(() => {
    if (!from || !to || to < from) return;
    setData(null);
    setError("");
    api<Report>(`/api/reports?from=${from}&to=${to}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [from, to]);

  if (!isAdmin) return <EmptyState title="Reports are for the owner / manager" description="Ask the hotel owner if you need this information." />;

  const download = (type: string) => window.open(`/api/reports/export?type=${type}&from=${from}&to=${to}`, "_blank");
  const t = data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="How your hotel is doing. Choose a period below. Download any list for Excel or your accountant." />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={period}
          onChange={setPeriod}
          tabs={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "month", label: "This month" },
            { value: "lastmonth", label: "Last month" },
            { value: "year", label: "This year" },
            { value: "custom", label: "Choose dates" },
          ]}
        />
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-auto" aria-label="From" />
            <span className="text-slate-500">to</span>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-auto" aria-label="To" />
          </div>
        )}
      </div>

      {error && <Tip tone="danger">{error}</Tip>}
      {!data || !t ? (
        !error && <Loading text="Preparing your report..." />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {formatDate(data.from)} to {formatDate(data.to)} · {data.days} day{data.days > 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="How full (occupancy)" value={`${t.occupancy}%`} subtitle={`${t.roomNightsSold} of ${t.availableRoomNights} room-nights`} icon={<Percent className="h-5 w-5" />} tone="sky" />
            <StatCard title="Room earnings" value={formatCurrency(Math.round(t.roomRevenue))} subtitle="Before tax, after discounts" icon={<BedDouble className="h-5 w-5" />} />
            <StatCard title="Average price per night" value={formatCurrency(Math.round(t.adr))} subtitle="ADR" icon={<IndianRupee className="h-5 w-5" />} tone="slate" />
            <StatCard title="Earnings per room" value={formatCurrency(Math.round(t.revpar))} subtitle="RevPAR: per available room per night" icon={<TrendingUp className="h-5 w-5" />} tone="slate" />
            <StatCard title="Money received" value={formatCurrency(Math.round(t.collected))} subtitle={t.refunds ? `after ${formatCurrency(t.refunds)} refunds` : "Cash, UPI, card, bank"} icon={<Wallet className="h-5 w-5" />} tone="green" />
            <StatCard title="Money owed to you" value={formatCurrency(Math.round(t.outstanding))} subtitle="All unpaid bills (any date)" icon={<Wallet className="h-5 w-5" />} tone={t.outstanding > 0 ? "red" : "green"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Rooms sold each night" description="How many rooms had a guest each night." />
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.series} margin={{ left: -20, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} minTickGap={16} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f1f5f9" }}
                      labelFormatter={(v) => formatDate(String(v))}
                      formatter={(v, _n, item) => [`${v} rooms (${(item.payload as { occupancy: number }).occupancy}% full)`, "Rooms sold"]}
                    />
                    <Bar dataKey="roomsSold" fill={CHART_BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Money received each day" description="Payments minus refunds." />
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.series} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} minTickGap={16} />
                    <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} labelFormatter={(v) => formatDate(String(v))} formatter={(v) => [formatCurrency(Number(v)), "Received"]} />
                    <Bar dataKey="collected" fill={CHART_GREEN} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <div>
            <button onClick={() => setShowTable((s) => !s)} className="text-sm font-semibold text-primary-600 hover:underline">
              {showTable ? "Hide" : "Show"} day-by-day table
            </button>
            {showTable && (
              <Card className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2 text-right">Rooms sold</th>
                      <th className="px-4 py-2 text-right">Occupancy</th>
                      <th className="px-4 py-2 text-right">Room earnings</th>
                      <th className="px-4 py-2 text-right">Money received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.series.map((d) => (
                      <tr key={d.date}>
                        <td className="px-4 py-2">{formatDate(d.date)}</td>
                        <td className="px-4 py-2 text-right">{d.roomsSold}</td>
                        <td className="px-4 py-2 text-right">{d.occupancy}%</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(d.roomRevenue)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(d.collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Where bookings came from" description="Room earnings by source" />
              <CardContent>
                <BarList data={Object.entries(data.bySource).map(([k, v]) => ({ key: k, value: v.revenue, sub: `${v.bookings} booking${v.bookings > 1 ? "s" : ""}` }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="How guests paid" />
              <CardContent>
                <BarList data={Object.entries(data.byMethod).map(([k, v]) => ({ key: k, value: v }))} empty="No payments" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Earnings by room type" />
              <CardContent>
                <BarList data={Object.entries(data.byRoomType).map(([k, v]) => ({ key: k, value: v.revenue, sub: `${v.nights} nights` }))} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Extras sold" description="Food, laundry and other items" />
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
            <Card>
              <CardHeader title="Bookings" />
              <CardContent>
                <Row label="New stays starting">{t.bookings}</Row>
                <Row label="Cancelled">{t.cancelled}</Row>
                <Row label="Did not come">{t.noShows}</Row>
                <Row label="Extras earnings">{formatCurrency(t.extrasRevenue)}</Row>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader title="Download for Excel / accountant" description="Files open in Excel, Google Sheets or any spreadsheet app." />
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" onClick={() => download("bookings")}>
                <Download className="h-4 w-4" /> Bookings
              </Button>
              <Button variant="outline" onClick={() => download("payments")}>
                <Download className="h-4 w-4" /> Payments
              </Button>
              <Button variant="outline" onClick={() => download("invoices")}>
                <Download className="h-4 w-4" /> GST invoices
              </Button>
              <Button variant="outline" onClick={() => download("daily")}>
                <Download className="h-4 w-4" /> Day-by-day summary
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
