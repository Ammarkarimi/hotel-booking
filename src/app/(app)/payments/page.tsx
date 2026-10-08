"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { Card, CardHeader, EmptyState, Input, Loading, PageHeader, StatCard, Tabs } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { addDays, todayKey } from "@/lib/dates";
import { cn, formatCurrency, formatDateTime, label, PAYMENT_METHODS } from "@/lib/utils";

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  type: string;
  reference: string | null;
  receivedBy: string | null;
  paidAt: string;
  booking: { id: string; number: number; guest: { firstName: string; lastName: string }; room: { roomNumber: string } };
}

type Period = "today" | "yesterday" | "week" | "month" | "custom";

export default function PaymentsPage() {
  const { settings } = useApp();
  const today = settings.today;
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    const ranges: Record<Exclude<Period, "custom">, [string, string]> = {
      today: [today, today],
      yesterday: [addDays(today, -1), addDays(today, -1)],
      week: [addDays(today, -6), today],
      month: [`${today.slice(0, 7)}-01`, today],
    };
    if (period !== "custom") {
      setFrom(ranges[period][0]);
      setTo(ranges[period][1]);
    }
  }, [period, today]);

  useEffect(() => {
    if (!from || !to) return;
    setRows(null);
    api<PaymentRow[]>(`/api/payments?from=${from}&to=${to}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [from, to]);

  // Payments are real moments in time; group them by the hotel's local date.
  const inRange = useMemo(
    () =>
      (rows ?? []).filter((p) => {
        const k = todayKey(settings.timezone, new Date(p.paidAt));
        return k >= from && k <= to;
      }),
    [rows, from, to, settings.timezone]
  );

  const byMethod: Record<string, number> = {};
  let total = 0;
  let refunds = 0;
  for (const p of inRange) {
    const signed = p.type === "refund" ? -p.amount : p.amount;
    if (p.type === "refund") refunds += p.amount;
    total += signed;
    byMethod[p.method] = (byMethod[p.method] || 0) + signed;
  }

  return (
    <div>
      <PageHeader title="Payments" description="All money received and refunded. Use “Today” at the end of a shift to count the cash drawer." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={period}
          onChange={setPeriod}
          tabs={[
            { value: "today", label: "Today" },
            { value: "yesterday", label: "Yesterday" },
            { value: "week", label: "Last 7 days" },
            { value: "month", label: "This month" },
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

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total received" value={formatCurrency(total)} subtitle={refunds ? `after ${formatCurrency(refunds)} refunds` : `${inRange.length} payment(s)`} icon={<Wallet className="h-5 w-5" />} />
        {PAYMENT_METHODS.map((m) => (
          <StatCard key={m} title={label(m)} value={formatCurrency(byMethod[m] || 0)} tone="slate" />
        ))}
      </div>

      {rows === null ? (
        <Loading />
      ) : inRange.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="No payments in this period" />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title={`${inRange.length} payment${inRange.length === 1 ? "" : "s"}`} />
          <ul className="divide-y divide-slate-100">
            {inRange.map((p) => (
              <li key={p.id}>
                <Link href={`/bookings/${p.booking.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {p.booking.guest.firstName} {p.booking.guest.lastName} · Room {p.booking.room.roomNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(p.paidAt)} · #{p.booking.number} · {label(p.type)} by {label(p.method)}
                      {p.reference && ` (${p.reference})`}
                      {p.receivedBy && ` · ${p.receivedBy}`}
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-lg font-bold", p.type === "refund" ? "text-violet-700" : "text-emerald-700")}>
                    {p.type === "refund" ? "− " : ""}
                    {formatCurrency(p.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
