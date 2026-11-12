"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Link2, RefreshCw, Unplug } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Modal, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import type { ChannexStatus } from "@/lib/channex-sync";

/** "5 minutes ago", "yesterday at 4:10 pm". */
function ago(iso: string | null): string | null {
  if (!iso) return null;
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

const SITES = "MakeMyTrip, Booking.com, Agoda, Goibibo, Expedia and Airbnb";

/** Booking sites → the full two-way connection through Channex. */
export function ChannexPanel({ onChanged }: { onChanged?: () => void }) {
  const { isAdmin, toast, confirm } = useApp();
  const [status, setStatus] = useState<ChannexStatus | null>(null);
  const [busy, setBusy] = useState<"connect" | "push" | "markup" | "screen" | "disconnect" | null>(null);
  const [markup, setMarkup] = useState("");
  const [screenUrl, setScreenUrl] = useState<string | null>(null);

  const show = useCallback((s: ChannexStatus) => {
    setStatus(s);
    setMarkup(String(s.markup ?? 0));
  }, []);

  const load = useCallback(async () => {
    try {
      show(await api<ChannexStatus>("/api/channels/channex"));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, [show, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function connect() {
    setBusy("connect");
    try {
      const res = await api<{ pushed: boolean; warning: string | null; status: ChannexStatus }>("/api/channels/channex", { method: "POST" });
      show(res.status);
      toast(res.warning ?? "Connected. Now press “Set up booking sites” to join each site.", res.warning ? "error" : "success");
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
      load();
    } finally {
      setBusy(null);
    }
  }

  async function sendAgain() {
    setBusy("push");
    try {
      const res = await api<{ pulled: number; error: string | null; status: ChannexStatus }>("/api/channels/channex/push", { method: "POST" });
      show(res.status);
      if (res.error) toast(res.error, "error");
      else toast(res.pulled ? `Sent. ${res.pulled} new or changed ${res.pulled === 1 ? "booking" : "bookings"} brought in.` : "Free rooms and prices for the next year sent again.", "success");
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveMarkup() {
    const value = Number(markup);
    if (markup.trim() === "" || !Number.isFinite(value) || value < 0 || value > 100) {
      toast("Please enter a number from 0 to 100.", "error");
      return;
    }
    setBusy("markup");
    try {
      const res = await api<{ error: string | null; status: ChannexStatus }>("/api/channels/channex", { method: "PATCH", body: { markup: value } });
      show(res.status);
      toast(res.error ?? "Saved. The new prices were sent to your booking sites.", res.error ? "error" : "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function openScreen() {
    setBusy("screen");
    try {
      setScreenUrl((await api<{ url: string }>("/api/channels/channex/iframe", { method: "POST" })).url);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  /** The address works only once, so the new tab gets a fresh one. */
  async function openInTab() {
    const tab = window.open("about:blank", "_blank");
    try {
      const { url } = await api<{ url: string }>("/api/channels/channex/iframe", { method: "POST" });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setScreenUrl(null);
    } catch (e) {
      tab?.close();
      toast((e as Error).message, "error");
    }
  }

  function closeScreen() {
    setScreenUrl(null);
    // The owner may have joined a site: its bookings can come in now.
    void sendAgainQuietly();
  }

  async function sendAgainQuietly() {
    try {
      await api("/api/channels/sync", { method: "POST", body: { force: false } });
      onChanged?.();
      load();
    } catch {
      // The screen shows the state on its next check.
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title: "Disconnect booking sites?",
      message: (
        <>
          Your free rooms and prices will no longer be sent, and new bookings from the sites will <b>not</b> come in by themselves. Bookings already brought in stay as they are. Your hotel
          and its sites stay set up at Channex, so connecting again later is quick. To stop selling on a site altogether, switch it off there too.
        </>
      ),
      confirmText: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    setBusy("disconnect");
    try {
      await api("/api/channels/channex", { method: "DELETE" });
      toast("Disconnected. Your hotel is still set up at Channex.", "success");
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (!status) return null;

  const title = "Full connection to booking sites";

  // (a) The software provider has not switched it on.
  if (!status.configured) {
    return (
      <Card>
        <CardHeader title={title} />
        <CardContent>
          <p className="text-sm text-slate-700">
            The full connection to {SITES} is added by your software provider. With it, your free rooms and prices go to every site by themselves, and their bookings come straight into
            your calendar. Ask your provider if you would like it. Meanwhile, the calendar links below already keep your rooms from being sold twice on sites that offer them.
          </p>
        </CardContent>
      </Card>
    );
  }

  // (b) Switched on, but this hotel has not connected yet.
  if (!status.connected) {
    return (
      <Card>
        <CardHeader title={title} description={`${SITES}, through Channex.`} />
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Your free rooms and prices for the next year are sent to every site you join, and kept up to date by themselves after each booking or price change.</li>
            <li>Bookings, changes and cancellations from the sites come into your bookings by themselves, in a free room of the right type.</li>
            <li>You join each site yourself, with your hotel&apos;s own account on that site. Your contract and payments with the site stay as they are.</li>
          </ul>
          {status.rooms.length === 0 && <Tip tone="warning">Add your rooms first (Rooms → Add room). Each kind of room (single, double, deluxe…) becomes one room type on the sites.</Tip>}
          {isAdmin ? (
            <Button onClick={connect} loading={busy === "connect"} disabled={status.rooms.length === 0}>
              <Link2 className="h-4 w-4" /> Connect booking sites
            </Button>
          ) : (
            <p className="text-sm font-semibold text-slate-600">Ask the owner or manager to connect booking sites.</p>
          )}
          {status.lastError && <p className="whitespace-pre-line text-sm font-semibold text-red-700">{status.lastError}</p>}
        </CardContent>
      </Card>
    );
  }

  // (c) Connected.
  const pushed = ago(status.lastPushAt);
  const pulled = ago(status.lastPullAt);
  return (
    <Card>
      <CardHeader title={title} description={`${SITES}, through Channex.`} />
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          {status.sandbox && (
            <p className="font-semibold text-amber-700">Test connection: this is Channex&apos;s test server, so nothing reaches the real booking sites yet.</p>
          )}
          <p className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {pushed ? `Free rooms and prices sent ${pushed}.` : "Free rooms and prices not sent yet."} {pulled ? `Bookings checked ${pulled}.` : "Bookings not checked yet."}
          </p>
          {!status.instant && <p className="text-slate-500">New bookings come in when this screen, the Dashboard or the Calendar opens, and every few minutes by themselves.</p>}
          {status.lastError && (
            <p className="flex items-start gap-2 whitespace-pre-line font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {status.lastError}
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chrome-line text-left text-xs text-slate-500">
                <th className="py-1 pr-3 font-semibold">Room type</th>
                <th className="py-1 pr-3 font-semibold">Rooms</th>
                <th className="py-1 font-semibold">Price tonight on the sites</th>
              </tr>
            </thead>
            <tbody>
              {status.rooms.map((r) => (
                <tr key={r.type} className="border-b border-slate-100">
                  <td className="py-1 pr-3 font-semibold text-slate-800">{r.label}</td>
                  <td className="py-1 pr-3">{r.rooms}</td>
                  <td className="py-1">{r.roomTypeId ? formatCurrency(r.priceTonight) : <span className="text-slate-500">sent with the next update</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">
            The lowest price of each room type, with your weekend and season prices. Rooms under repair are not sold. The sites may add their own taxes or discounts.
          </p>
        </div>

        {isAdmin && (
          <Field label="Add to prices sent to booking sites" hint="Covers the site's commission: with 15%, a ₹2,000 room shows as ₹2,300 on the sites. Your own prices at the desk stay the same.">
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Percent added to prices sent to booking sites"
                className="min-h-9 w-24 rounded-sm border border-chrome-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                value={markup}
                onChange={(e) => setMarkup(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))}
              />
              <span className="text-sm text-slate-700">%</span>
              <Button size="sm" variant="outline" onClick={saveMarkup} loading={busy === "markup"} disabled={Number(markup) === status.markup}>
                Save
              </Button>
            </div>
          </Field>
        )}

        {isAdmin ? (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <Button onClick={openScreen} loading={busy === "screen"}>
              <ExternalLink className="h-4 w-4" /> Set up booking sites
            </Button>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Choose the site (for example MakeMyTrip or Booking.com).</li>
              <li>Sign in with your hotel&apos;s own account on that site (the one you use for its extranet).</li>
              <li>Match each of the site&apos;s rooms to your room type and its “Standard rate”.</li>
              <li>Switch the site on. From then on its bookings come in by themselves.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={sendAgain} loading={busy === "push"}>
                <RefreshCw className="h-4 w-4" /> Send everything again
              </Button>
              <Button variant="ghost" onClick={disconnect} loading={busy === "disconnect"}>
                <Unplug className="h-4 w-4" /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">The owner or manager joins the sites and sets the prices here.</p>
        )}
      </CardContent>

      <Modal
        open={!!screenUrl}
        onClose={closeScreen}
        size="xl"
        title="Set up booking sites"
        description="Choose a site, sign in with your hotel's account on it, match its rooms to yours, and switch it on."
        footer={
          <>
            <button type="button" onClick={openInTab} className="mr-auto inline-flex items-center gap-1 text-sm font-semibold text-primary-700 underline">
              Screen empty? Open it in a new tab <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <Button variant="outline" onClick={closeScreen}>
              Done
            </Button>
          </>
        }
      >
        {screenUrl && <iframe src={screenUrl} title="Booking sites at Channex" className="h-[70vh] w-full border-0" allow="clipboard-write" />}
      </Modal>
    </Card>
  );
}
