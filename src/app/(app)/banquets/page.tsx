"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, List, PartyPopper, Plus, Search, Settings2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Loading, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { addDays, formatDateKey } from "@/lib/dates";
import type { BanquetDTO, BanquetSetup } from "@/lib/banquet-types";
import { cn, formatCurrency, formatDate, label } from "@/lib/utils";

type View = "upcoming" | "today" | "enquiries" | "unpaid" | "past" | "cancelled" | "all";

const VIEWS: Array<{ value: View; label: string; help: string }> = [
  { value: "upcoming", label: "Coming", help: "Functions on hold or confirmed, from today" },
  { value: "today", label: "Today", help: "Functions in the halls today" },
  { value: "enquiries", label: "Enquiries", help: "Quotations given; call back on the follow-up date" },
  { value: "unpaid", label: "Not fully paid", help: "Functions held whose bill still has money to collect" },
  { value: "past", label: "Past", help: "Functions already held" },
  { value: "cancelled", label: "Cancelled", help: "Cancelled functions and what was kept" },
  { value: "all", label: "All", help: "Every function" },
];

const CAL_STYLE: Record<string, string> = {
  enquiry: "border-sky-200 bg-sky-50 text-sky-900",
  tentative: "border-amber-300 bg-amber-50 text-amber-900",
  confirmed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
};

function HallCalendar({ setup }: { setup: BanquetSetup }) {
  const { settings } = useApp();
  const router = useRouter();
  const [start, setStart] = useState(settings.today);
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  const [rows, setRows] = useState<BanquetDTO[] | null>(null);

  useEffect(() => {
    setRows(null);
    api<BanquetDTO[]>(`/api/banquets?from=${start}&to=${addDays(start, 13)}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [start]);

  const halls = setup.halls.filter((h) => h.active);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-600">Tap a free day to book that hall. Green confirmed · amber on hold · blue enquiry.</p>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" aria-label="Earlier" onClick={() => setStart(addDays(start, -14))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStart(settings.today)}>
            Today
          </Button>
          <Button size="sm" variant="outline" aria-label="Later" onClick={() => setStart(addDays(start, 14))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {rows === null ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 w-32 bg-slate-50 px-3 py-2 text-left">Hall</th>
                {days.map((d) => (
                  <th key={d} className={cn("px-1 py-2 text-center font-semibold", d === settings.today && "bg-primary-50 text-primary-700")}>
                    {formatDateKey(d, { weekday: "short", day: undefined, month: undefined, year: undefined })}
                    <br />
                    {formatDateKey(d, { year: undefined })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {halls.map((h) => (
                <tr key={h.id} className="border-t border-slate-100 align-top">
                  <td className="sticky left-0 bg-white px-3 py-2 font-semibold">
                    {h.name}
                    {h.capacity > 0 && <span className="block font-normal text-slate-400">{h.capacity} guests</span>}
                  </td>
                  {days.map((d) => {
                    const here = rows.filter((r) => r.hallId === h.id && r.eventDate === d);
                    return (
                      <td key={d} className="border-l border-slate-100 p-1">
                        <div className="space-y-1">
                          {here.map((r) => (
                            <Link key={r.id} href={`/banquets/${r.id}`} className={cn("block rounded-md border px-1.5 py-1 leading-tight hover:shadow", CAL_STYLE[r.status])}>
                              <span className="block font-semibold">{r.startTime}</span>
                              <span className="block truncate">{r.customerName}</span>
                              <span className="block text-[10px] opacity-75">{r.bill.billedPax} guests</span>
                            </Link>
                          ))}
                          {d >= settings.today && (
                            <button
                              type="button"
                              onClick={() => router.push(`/banquets/new?hall=${h.id}&date=${d}`)}
                              className="block w-full rounded-md border border-dashed border-slate-200 py-1 text-slate-400 hover:border-primary-300 hover:text-primary-600"
                              aria-label={`Book ${h.name} on ${d}`}
                            >
                              +
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BanquetsList() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAdmin, settings } = useApp();
  const [view, setView] = useState<View>((params.get("view") as View) || "upcoming");
  const [mode, setMode] = useState<"list" | "calendar">(params.get("mode") === "calendar" ? "calendar" : "list");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<BanquetDTO[] | null>(null);
  const [setup, setSetup] = useState<BanquetSetup | null>(null);

  useEffect(() => {
    api<BanquetSetup>("/api/banquets/setup").then(setSetup).catch(() => setSetup({ halls: [], menus: [], defaults: { foodGst: 5, hallGst: 18, itemGst: 18, prefix: "BQ", terms: null } }));
  }, []);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ view });
    if (q.trim()) qs.set("q", q.trim());
    api<BanquetDTO[]>(`/api/banquets?${qs}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [view, q]);

  useEffect(() => {
    if (mode !== "list") return;
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q, mode]);

  function changeView(v: View) {
    setView(v);
    setRows(null);
    router.replace(`/banquets?view=${v}`);
  }

  if (!setup) return <Loading />;
  if (setup.halls.length === 0) {
    return (
      <div>
        <PageHeader title="Banquets" description="Weddings, parties and meetings in your halls." />
        <EmptyState
          icon={<PartyPopper className="h-6 w-6" />}
          title="Add your halls to start"
          description={isAdmin ? "Add each hall (or lawn, terrace, meeting room) with its rent, and your menus with the price per plate." : "Ask the owner to add the hotel's halls and menus."}
          action={
            isAdmin && (
              <Link href="/banquets/setup">
                <Button>Add halls & menus</Button>
              </Link>
            )
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Banquets"
        description={mode === "calendar" ? "Which halls are free, two weeks at a time." : VIEWS.find((v) => v.value === view)?.help}
        actions={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Link href="/banquets/setup">
                <Button variant="outline">
                  <Settings2 className="h-4 w-4" /> Halls & menus
                </Button>
              </Link>
            )}
            <Link href="/banquets/new">
              <Button>
                <Plus className="h-5 w-5" /> New function
              </Button>
            </Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={mode}
          onChange={setMode}
          tabs={[
            {
              value: "list",
              label: (
                <span className="flex items-center gap-1.5">
                  <List className="h-4 w-4" /> List
                </span>
              ),
            },
            {
              value: "calendar",
              label: (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" /> Hall calendar
                </span>
              ),
            },
          ]}
        />
        {mode === "list" && (
          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input className="pl-10" placeholder="Name, mobile, company or function #" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
      </div>

      {mode === "calendar" ? (
        <HallCalendar setup={setup} />
      ) : (
        <>
          <Tabs tabs={VIEWS} value={view} onChange={changeView} className="mb-4" />
          {rows === null ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState icon={<PartyPopper className="h-6 w-6" />} title={q ? "No functions match your search" : "No functions here"} />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {rows.map((b) => {
                  const due = ["confirmed", "completed", "tentative"].includes(b.status) && b.bill.balance > 0.5;
                  const followUpDue = b.followUpOn && b.followUpOn <= settings.today && (b.status === "enquiry" || b.status === "tentative");
                  return (
                    <li key={b.id}>
                      <Link href={`/banquets/${b.id}`} className="grid gap-2 px-5 py-3 hover:bg-slate-50 md:grid-cols-12 md:items-center">
                        <div className="min-w-0 md:col-span-4">
                          <p className="truncate font-semibold text-slate-900">
                            {b.customerName}
                            {b.company && <span className="font-normal text-slate-500"> · {b.company}</span>}
                          </p>
                          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            #{b.number} · {label(b.eventType)} <StatusBadge status={b.status} />
                            {followUpDue && <Badge variant="warning">Follow up {b.followUpOn === settings.today ? "today" : "overdue"}</Badge>}
                          </p>
                        </div>
                        <div className="text-sm md:col-span-4">
                          <p className="font-medium">
                            {formatDate(b.eventDate)} · {b.startTime}–{b.endTime}
                          </p>
                          <p className="text-xs text-slate-500">
                            {b.hall.name} · {b.bill.billedPax} guests · {label(b.session)}
                          </p>
                        </div>
                        <div className="text-sm md:col-span-4 md:text-right">
                          <p className="font-semibold">{formatCurrency(b.bill.total)}</p>
                          {b.status === "cancelled" ? (
                            b.bill.netPaid > 0 && <p className="text-xs text-slate-500">kept {formatCurrency(b.bill.netPaid)}</p>
                          ) : due ? (
                            <p className="text-xs font-semibold text-red-600">to collect {formatCurrency(b.bill.balance)}</p>
                          ) : (
                            b.bill.netPaid > 0 && <Badge variant="paid">Fully paid</Badge>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function BanquetsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BanquetsList />
    </Suspense>
  );
}
