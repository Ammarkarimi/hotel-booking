"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Download, Timer } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Loading, PageHeader, Select } from "@/components/ui";
import { PeriodPicker, periodFor, type PeriodValue } from "@/components/period-picker";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { durationLabel, END_REASONS } from "@/lib/shift-report";
import { formatCurrency, label } from "@/lib/utils";
import type { ShiftDTO } from "@/lib/types";

interface ShiftList {
  from: string;
  to: string;
  shifts: ShiftDTO[];
  staff: Array<{ id: string; name: string; active: boolean }>;
}

function ShiftCard({ s, timeZone, onClose }: { s: ShiftDTO; timeZone: string; onClose?: () => void }) {
  const time = (d: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(d));
  const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(s.startedAt));
  const length = durationLabel((s.endedAt ? new Date(s.endedAt).getTime() : Date.now()) - new Date(s.startedAt).getTime());
  const sum = s.summary;
  const methods = Object.entries(sum.byMethod).filter(([, v]) => v !== 0);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">
            {s.staffName}
            {!s.open && !s.ownerSeenAt && (
              <Badge variant="info" className="ml-2 align-middle">
                New
              </Badge>
            )}
          </p>
          <p className="text-sm text-slate-600">
            {day} · {time(s.startedAt)} → {s.endedAt ? time(s.endedAt) : <b className="text-emerald-700">still on shift</b>} · {length}
          </p>
        </div>
        {s.open && onClose && (
          <Button size="sm" variant="outline" onClick={onClose}>
            Close shift
          </Button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
        <span>
          <b>{sum.checkIns}</b> check-in{sum.checkIns === 1 ? "" : "s"}
        </span>
        <span>
          <b>{sum.checkOuts}</b> check-out{sum.checkOuts === 1 ? "" : "s"}
        </span>
        <span>
          <b>{sum.bookingsMade}</b> new booking{sum.bookingsMade === 1 ? "" : "s"}
        </span>
        <span>
          Received <b>{formatCurrency(sum.received)}</b>
          {methods.length > 0 && <span className="text-slate-500"> ({methods.map(([m, v]) => `${label(m)} ${formatCurrency(v)}`).join(", ")})</span>}
        </span>
        <span>
          Cash to hand over <b>{formatCurrency(sum.cashInHand)}</b>
        </span>
      </div>
      {(sum.checkInList?.length || sum.checkOutList?.length) ? (
        <div className="mt-2 space-y-0.5 text-xs text-slate-600">
          {!!sum.checkInList?.length && <p>Checked in: {sum.checkInList.join(" · ")}</p>}
          {!!sum.checkOutList?.length && <p>Checked out: {sum.checkOutList.join(" · ")}</p>}
        </div>
      ) : null}
      {s.startNote && <p className="mt-2 text-sm text-slate-600">At the start: {s.startNote}</p>}
      {s.handoverNote && (
        <p className="mt-2 whitespace-pre-line rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[15px] text-slate-900">
          <span className="block text-xs font-semibold text-amber-800">Handover note</span>
          {s.handoverNote}
        </p>
      )}
      {!s.open && s.endReason !== "staff" && (
        <p className="mt-2 text-xs font-semibold text-amber-700">
          {END_REASONS[s.endReason ?? "staff"]}
          {s.endedBy ? ` (${s.endedBy})` : ""}: the staff member did not end it, so there is no handover note.
        </p>
      )}
      {s.reportText && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer font-semibold text-primary-700">Shift report as saved</summary>
          <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-slate-800">{s.reportText}</pre>
          <p className="text-xs text-slate-500">Saved when the shift ended. It cannot be changed, even if the WhatsApp message was edited before sending.</p>
        </details>
      )}
    </li>
  );
}

export default function ShiftsPage() {
  const { settings, isAdmin, confirm, toast } = useApp();
  const [period, setPeriod] = useState<PeriodValue>(() => periodFor("week", settings.today));
  const [staffId, setStaffId] = useState("");
  const [data, setData] = useState<ShiftList | null>(null);
  const [onShift, setOnShift] = useState<ShiftDTO[] | null>(null);

  const query = `from=${period.from}&to=${period.to}${staffId ? `&staffId=${staffId}` : ""}`;
  const load = useCallback(() => {
    setData(null);
    api<ShiftList>(`/api/shifts?${query}&markSeen=1`).then(setData).catch((e) => toast((e as Error).message, "error"));
    api<ShiftDTO[]>("/api/shifts?open=1").then(setOnShift).catch(() => setOnShift([]));
  }, [query, toast]);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  // Each person's totals for the period.
  const totals = useMemo(() => {
    const rows = new Map<string, { name: string; shifts: number; ms: number; checkIns: number; checkOuts: number; received: number }>();
    for (const s of data?.shifts ?? []) {
      const key = s.staffId ?? s.staffName;
      const t = rows.get(key) ?? { name: s.staffName, shifts: 0, ms: 0, checkIns: 0, checkOuts: 0, received: 0 };
      t.shifts += 1;
      t.ms += (s.endedAt ? new Date(s.endedAt).getTime() : Date.now()) - new Date(s.startedAt).getTime();
      t.checkIns += s.summary.checkIns;
      t.checkOuts += s.summary.checkOuts;
      t.received += s.summary.received;
      rows.set(key, t);
    }
    return [...rows.values()].sort((a, b) => b.ms - a.ms);
  }, [data]);

  async function closeShift(s: ShiftDTO) {
    const ok = await confirm({
      title: `Close ${s.staffName}'s shift?`,
      message: "Use this when someone forgot to end their shift. It ends now, without a handover note.",
      confirmText: "Yes, close it",
    });
    if (!ok) return;
    try {
      await api(`/api/shifts/${s.id}/end`, { body: {} });
      toast("Shift closed");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  if (!isAdmin) return <EmptyState title="Staff shifts are for the owner / manager" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff shifts"
        description="Attendance, handover notes, and what each person did on their shift."
        actions={
          <Button variant="outline" onClick={() => window.open(`/api/shifts?${query}&format=csv`, "_blank")}>
            <Download className="h-4 w-4" /> Download staff report
          </Button>
        }
      />

      <Card>
        <CardHeader title="On shift now" />
        {!onShift ? (
          <Loading />
        ) : onShift.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Nobody is on shift right now.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {onShift.map((s) => (
              <ShiftCard key={s.id} s={s} timeZone={settings.timezone} onClose={() => closeShift(s)} />
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PeriodPicker value={period} onChange={setPeriod} today={settings.today} />
        <Select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="lg:w-64" aria-label="Staff member">
          <option value="">Everyone</option>
          {(data?.staff ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.active ? "" : " (removed)"}
            </option>
          ))}
        </Select>
      </div>

      {!data ? (
        <Loading text="Loading shifts..." />
      ) : data.shifts.length === 0 ? (
        <EmptyState icon={<Timer className="h-6 w-6" />} title="No shifts in this period" description="Shifts appear here when front-desk staff start and end them." />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <CardHeader title="Attendance" description="Hours on shift and work done, per person" />
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-2">Staff</th>
                  <th className="px-3 py-2 text-right">Shifts</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2 text-right">Check-ins</th>
                  <th className="px-3 py-2 text-right">Check-outs</th>
                  <th className="px-3 py-2 text-right">Money received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {totals.map((t) => (
                  <tr key={t.name}>
                    <td className="px-5 py-2 font-medium">{t.name}</td>
                    <td className="px-3 py-2 text-right">{t.shifts}</td>
                    <td className="px-3 py-2 text-right">{durationLabel(t.ms)}</td>
                    <td className="px-3 py-2 text-right">{t.checkIns}</td>
                    <td className="px-3 py-2 text-right">{t.checkOuts}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(t.received)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title={`Shifts (${data.shifts.length})`} description="Newest first, with each handover note" />
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {data.shifts.map((s) => (
                  <ShiftCard key={s.id} s={s} timeZone={settings.timezone} onClose={s.open ? () => closeShift(s) : undefined} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Clock className="h-4 w-4" /> Check-ins, check-outs and payments are counted from what each person did in the app during their shift.
      </p>
    </div>
  );
}
