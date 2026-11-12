"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { siteName } from "@/lib/channels";
import { formatDateTime } from "@/lib/utils";

export interface ChannelIssueDTO {
  id: string;
  source: string;
  kind: string;
  title: string;
  details: string | null;
  bookingId: string | null;
  status: string;
  createdAt: string;
  closedAt: string | null;
  closedBy: string | null;
}

/** Booking sites → things a person has to look at (a room sold twice, a change to a guest already staying). */
export function ChannelIssues({ open, closed, onChanged }: { open: ChannelIssueDTO[]; closed: ChannelIssueDTO[]; onChanged: () => void }) {
  const { toast, confirm, settings } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  async function close(issue: ChannelIssueDTO) {
    const ok = await confirm({
      title: "Have you dealt with this?",
      message: "It will be taken off the list and not asked again.",
      confirmText: "Yes, done",
    });
    if (!ok) return;
    setBusy(issue.id);
    try {
      await api("/api/channels/issues", { method: "PATCH", body: { id: issue.id } });
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (!open.length && !closed.length) return null;
  return (
    <Card className={open.length ? "border-amber-300" : undefined}>
      <CardHeader
        title={open.length ? `Please look at ${open.length === 1 ? "this" : `these ${open.length}`}` : "Nothing waiting"}
        description={
          open.length
            ? "Something from a booking site could not be done by itself. Sort it out, then press Done."
            : "Every booking from your booking sites is in place."
        }
      />
      <CardContent className="space-y-3">
        {open.map((i) => (
          <div key={i.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{i.title}</p>
                {i.details && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{i.details}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {siteName(i.source)} · {formatDateTime(i.createdAt, settings.timezone)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {i.bookingId && (
                    <Link href={`/bookings/${i.bookingId}`}>
                      <Button size="sm" variant="outline">
                        Open the booking
                      </Button>
                    </Link>
                  )}
                  <Link href="/calendar">
                    <Button size="sm" variant="outline">
                      Open the calendar
                    </Button>
                  </Link>
                  <Button size="sm" onClick={() => close(i)} disabled={busy === i.id}>
                    <CheckCircle2 className="h-4 w-4" /> Done
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {closed.length > 0 && (
          <div>
            <button type="button" className="text-sm font-semibold text-primary-700 hover:underline" onClick={() => setShowClosed((v) => !v)}>
              {showClosed ? "Hide" : "Show"} the last {closed.length} sorted out
            </button>
            {showClosed && (
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {closed.map((i) => (
                  <li key={i.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-800">{i.title}</span>
                    <span className="block text-xs text-slate-500">
                      {i.closedBy ? `Marked done by ${i.closedBy}` : "Sorted out by itself"}
                      {i.closedAt ? ` · ${formatDateTime(i.closedAt, settings.timezone)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
