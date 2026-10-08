"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, IndianRupee, Plus, Search, Wallet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, EmptyState, Input, Loading, PageHeader, StatCard, Tabs, Tip } from "@/components/ui";
import { HotelStatusBadge, MonthStatusBadge, PAYMENT_METHOD_LABELS, money, type Overview } from "@/components/platform-ui";
import { api } from "@/lib/client";
import { monthLabel } from "@/lib/subscription";
import { formatDate } from "@/lib/utils";

type Filter = "all" | "unpaid" | "overdue" | "paused";

function lastSeen(date: string | null) {
  if (!date) return "Never signed in";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "Signed in today";
  if (days === 1) return "Signed in yesterday";
  return `Signed in ${days} days ago`;
}

export default function PlatformHome() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<Overview>("/api/platform/hotels").then(setData, (e) => setError(e.message));
  }, []);

  const hotels = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.hotels.filter((h) => {
      if (filter === "unpaid" && !["unpaid", "part_paid"].includes(h.subscription.currentStatus)) return false;
      if (filter === "overdue" && h.subscription.overdueMonths.length === 0) return false;
      if (filter === "paused" && h.status === "active") return false;
      if (!term) return true;
      return [h.name, h.city, h.contactName, h.contactPhone, h.slug].some((v) => v?.toLowerCase().includes(term));
    });
  }, [data, filter, q]);

  if (error) return <Tip tone="danger">{error}</Tip>;
  if (!data) return <Loading />;
  const t = data.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your hotels"
        description={`Who is using your software, and who has paid for ${monthLabel(data.month)}.`}
        actions={
          <Link href="/platform/hotels/new">
            <Button size="lg" className="bg-slate-900 hover:bg-slate-800">
              <Plus className="h-5 w-5" /> Add a hotel
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Hotels" value={t.hotels} subtitle={`${t.active} active${t.suspended ? `, ${t.suspended} paused` : ""}`} icon={<Building2 className="h-5 w-5" />} tone="slate" />
        <StatCard title={`Received in ${monthLabel(data.month)}`} value={money(t.collectedThisMonth)} subtitle={`Expected each month: ${money(t.expectedMonthly)}`} icon={<IndianRupee className="h-5 w-5" />} tone="green" />
        <StatCard
          title="Not paid this month"
          value={t.unpaidThisMonth}
          subtitle="Hotels to remind"
          icon={<Wallet className="h-5 w-5" />}
          tone={t.unpaidThisMonth ? "amber" : "green"}
          onClick={() => setFilter("unpaid")}
        />
        <StatCard
          title="Still to collect"
          value={money(t.outstanding)}
          subtitle={t.overdueHotels ? `${t.overdueHotels} hotel${t.overdueHotels > 1 ? "s" : ""} late from earlier months` : "Nobody is late"}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={t.overdueHotels ? "red" : "green"}
          onClick={() => setFilter("overdue")}
        />
      </div>

      <Card>
        <CardHeader title="Hotels" description="Tap a hotel to see its payments, sign-ins and details." />
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs<Filter>
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: "all", label: "All" },
                { value: "unpaid", label: "Not paid this month" },
                { value: "overdue", label: "Late" },
                { value: "paused", label: "Paused" },
              ]}
            />
            <div className="relative lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, city, phone" className="pl-9" aria-label="Search hotels" />
            </div>
          </div>

          {data.hotels.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No hotels yet"
              description="Add your first hotel. You'll get a sign-in to give to the hotel owner."
              action={
                <Link href="/platform/hotels/new">
                  <Button>
                    <Plus className="h-4 w-4" /> Add a hotel
                  </Button>
                </Link>
              }
            />
          ) : hotels.length === 0 ? (
            <p className="py-6 text-center text-slate-500">No hotels match.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hotels.map((h) => (
                <li key={h.id}>
                  <Link href={`/platform/hotels/${h.id}`} className="flex flex-col gap-2 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-900">{h.name}</span>
                        <HotelStatusBadge status={h.status} />
                      </div>
                      <p className="text-sm text-slate-500">
                        {[h.city, h.contactName, h.contactPhone].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {h.rooms} rooms · {h.bookings30d} bookings in the last 30 days · {lastSeen(h.lastLoginAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 sm:items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">{monthLabel(data.month)}:</span>
                        <MonthStatusBadge status={h.subscription.currentStatus} />
                      </div>
                      {h.subscription.overdueMonths.length > 0 && (
                        <span className="text-sm font-semibold text-red-700">
                          Late: {h.subscription.overdueMonths.map(monthLabel).join(", ")}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {h.monthlyFee > 0 ? `${money(h.monthlyFee)} / month` : "No monthly fee"}
                        {h.subscription.outstanding > 0 && ` · owes ${money(h.subscription.outstanding)}`}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data.recentPayments.length > 0 && (
        <Card>
          <CardHeader title="Latest payments received" />
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {data.recentPayments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                  <span className="min-w-0">
                    <Link href={`/platform/hotels/${p.hotel.id}`} className="font-semibold text-slate-900 hover:underline">
                      {p.hotel.name}
                    </Link>
                    <span className="text-slate-500"> · for {monthLabel(p.month)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                  </span>
                  <span className="text-right">
                    <b>{money(p.amount)}</b> <span className="text-sm text-slate-500">on {formatDate(p.paidOn)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
