"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, PageHeader, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { ChannelIssues, type ChannelIssueDTO } from "@/components/channel-issues";
import { ChannexPanel } from "@/components/channex-panel";
import { CalendarLinks } from "@/components/channel-calendars";
import { api } from "@/lib/client";

interface SyncResult {
  calendars: { read: number; created: number; updated: number; cancelled: number; issues: number; errors: number } | null;
  channex: { connected: boolean; pulled: number; pushed: boolean; error: string | null } | null;
  openIssues: number;
}

/** What "Check now" found, in one plain sentence. */
function summary(r: SyncResult) {
  const made = r.calendars?.created ?? 0;
  const moved = r.calendars?.updated ?? 0;
  const gone = r.calendars?.cancelled ?? 0;
  const pulled = r.channex?.pulled ?? 0;
  const parts = [
    made + pulled > 0 ? `${made + pulled} new or changed from booking sites` : "",
    moved > 0 ? `${moved} moved` : "",
    gone > 0 ? `${gone} cancelled` : "",
    r.channex?.pushed ? "free rooms and prices sent" : "",
  ].filter(Boolean);
  const failed = (r.calendars?.errors ?? 0) > 0 || !!r.channex?.error;
  if (failed) return { text: "Checked, but one booking site could not be reached. See below.", tone: "error" as const };
  return { text: parts.length ? `Checked: ${parts.join(", ")}.` : "Checked: everything is up to date.", tone: "success" as const };
}

/** Booking sites: the channel manager. Keeps free rooms in step with the sites and brings their bookings in. */
export default function ChannelsPage() {
  const { toast } = useApp();
  const [issues, setIssues] = useState<{ open: ChannelIssueDTO[]; closed: ChannelIssueDTO[] } | null>(null);
  const [checking, setChecking] = useState(false);
  // Tells the two panels to load again after a check brought something in.
  const [round, setRound] = useState(0);

  const loadIssues = useCallback(() => {
    api<{ open: ChannelIssueDTO[]; closed: ChannelIssueDTO[] }>("/api/channels/issues")
      .then(setIssues)
      .catch(() => undefined);
  }, []);

  const check = useCallback(
    async (force: boolean) => {
      if (force) setChecking(true);
      try {
        const r = await api<SyncResult>("/api/channels/sync", { method: "POST", body: { force } });
        if (force) {
          const s = summary(r);
          toast(s.text, s.tone);
        }
        if (force || (r.calendars?.created ?? 0) + (r.calendars?.updated ?? 0) + (r.calendars?.cancelled ?? 0) + (r.channex?.pulled ?? 0) > 0) setRound((n) => n + 1);
      } catch (e) {
        if (force) toast((e as Error).message, "error");
      } finally {
        if (force) setChecking(false);
        loadIssues();
      }
    },
    [toast, loadIssues]
  );

  useEffect(() => {
    loadIssues();
    check(false);
    const t = setInterval(() => check(false), 5 * 60_000);
    return () => clearInterval(t);
  }, [check, loadIssues]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking sites"
        description="Keeps your free rooms the same on MakeMyTrip, Booking.com, Airbnb and the other sites, and puts their bookings into your calendar by themselves, so a room is not sold twice."
        actions={
          <Button variant="outline" onClick={() => check(true)} disabled={checking}>
            <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> {checking ? "Checking…" : "Check now"}
          </Button>
        }
      />

      {issues && <ChannelIssues open={issues.open} closed={issues.closed} onChanged={loadIssues} />}

      <ChannexPanel key={`x${round}`} onChanged={loadIssues} />
      <CalendarLinks key={`c${round}`} onChanged={loadIssues} />

      <Tip>
        A booking that comes from a site is marked with the site&apos;s name in Bookings and on the Calendar. Check the guest&apos;s name, phone and price on it when the guest arrives: sites do not always
        send everything.
      </Tip>
    </div>
  );
}
