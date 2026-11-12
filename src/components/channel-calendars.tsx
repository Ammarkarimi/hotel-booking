"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Link2, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, Field, Input, Loading, Modal, Select, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { label } from "@/lib/utils";
import { siteName } from "@/lib/channels";
import type { CalendarLinkDTO, CalendarLinksDTO, CalendarSyncResult } from "@/lib/channel-calendars";

/** The sites that give a calendar link for a listing. MakeMyTrip and Goibibo do not. */
const LINK_SITES: Array<{ value: string; label: string }> = [
  { value: "airbnb", label: "Airbnb" },
  { value: "booking_com", label: "Booking.com (homes and apartments)" },
  { value: "agoda", label: "Agoda Homes" },
  { value: "other", label: "Another site (Vrbo, Tripadvisor…)" },
];

/** Where each site keeps its calendar links. */
function sitePlaces(source: string): { paste: string; copy: string } {
  switch (source) {
    case "airbnb":
      return {
        paste: "On Airbnb open your listing, then Calendar → Availability → Connect calendars → “Import calendar”. Paste the link there and give it a name, for example “Hotel”.",
        copy: "In the same place on Airbnb, choose “Export calendar” and copy the link it shows.",
      };
    case "booking_com":
      return {
        paste: "On Booking.com (the extranet) open Rates & Availability → Sync calendars → Add calendar connection. Paste the link there.",
        copy: "Booking.com then shows its own link in the next step (“Export calendar”). Copy it.",
      };
    case "agoda":
      return {
        paste: "On Agoda Homes open Calendar → Sync calendar, choose to import a calendar and paste the link there.",
        copy: "In the same place on Agoda, choose “Export calendar” and copy the link it shows.",
      };
    default:
      return {
        paste: "On the site, open the calendar of your listing and look for “Import calendar” or “Calendar sync”. Paste the link there.",
        copy: "In the same place, look for “Export calendar” and copy the link it shows.",
      };
  }
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function whereOf(c: CalendarLinkDTO) {
  return c.roomNumber ? `Room ${c.roomNumber}` : `All ${label(c.roomType ?? "")} rooms`;
}

function fullLink(c: CalendarLinkDTO) {
  return `${typeof window === "undefined" ? "" : window.location.origin}${c.exportPath}`;
}

type ReadResult = CalendarSyncResult & { error: string | null; events: number };

/** What a read found, in one sentence. */
function readSentence(site: string, r: ReadResult) {
  const parts = [
    r.created ? count(r.created, "new booking", "new bookings") : null,
    r.updated ? count(r.updated, "booking changed", "bookings changed") : null,
    r.cancelled ? count(r.cancelled, "booking cancelled", "bookings cancelled") : null,
    r.issues ? `${count(r.issues, "stay needs", "stays need")} you to look (see the questions on this page)` : null,
  ].filter(Boolean);
  return parts.length ? `${site}: ${parts.join(", ")}.` : `Nothing new on ${site}.`;
}

/** Booking sites → Calendar links (iCal). */
export function CalendarLinks({ onChanged }: { onChanged?: () => void }) {
  const { isAdmin, toast, confirm } = useApp();
  const [data, setData] = useState<CalendarLinksDTO | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // "<id>:<what>" while a button is working
  const [adding, setAdding] = useState(false);
  const [stepsFor, setStepsFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<CalendarLinksDTO>("/api/channels/calendars"));
      setFailed(null);
    } catch (error) {
      setFailed((error as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Link copied");
    } catch {
      toast("Could not copy. Please select the link and copy it.", "error");
    }
  }

  /** Reads one site's calendar now. Returns the sentence to show. */
  async function read(c: CalendarLinkDTO, quiet = false) {
    setBusy(`${c.id}:read`);
    try {
      const r = await api<ReadResult>(`/api/channels/calendars/${c.id}`, { method: "POST" });
      if (r.error) toast(`${c.siteName}'s calendar could not be read. ${r.error}`, "error");
      else if (!quiet) toast(readSentence(c.siteName, r), r.issues ? "info" : "success");
      return r;
    } catch (error) {
      toast((error as Error).message, "error");
      return null;
    } finally {
      setBusy(null);
      await load();
      onChanged?.();
    }
  }

  async function setActive(c: CalendarLinkDTO, active: boolean) {
    if (!active) {
      const ok = await confirm({
        title: `Pause the link with ${c.siteName}?`,
        message: `While it is paused, ${c.siteName} cannot see your booked nights for ${whereOf(c)} and its bookings do not come in. Close the nights on ${c.siteName} yourself until you turn it on again.`,
        confirmText: "Yes, pause",
      });
      if (!ok) return;
    }
    setBusy(`${c.id}:active`);
    try {
      await api(`/api/channels/calendars/${c.id}`, { method: "PATCH", body: { active } });
      toast(active ? "The link is on again" : "The link is paused");
      await load();
      onChanged?.();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: CalendarLinkDTO) {
    const ok = await confirm({
      title: `Remove the link with ${c.siteName}?`,
      message: (
        <>
          {c.siteName} will no longer see your booked nights for {whereOf(c)}, and its bookings will no longer come in by themselves. The bookings it already brought stay in your bookings.
          <br />
          <br />
          Remember to remove the calendar on {c.siteName} too.
        </>
      ),
      danger: true,
      confirmText: "Yes, remove",
    });
    if (!ok) return;
    setBusy(`${c.id}:remove`);
    try {
      await api(`/api/channels/calendars/${c.id}`, { method: "DELETE" });
      toast("Calendar link removed");
      await load();
      onChanged?.();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  const calendars = data?.calendars ?? [];
  const steps = calendars.find((c) => c.id === stepsFor) ?? null;

  return (
    <Card className="mb-6">
      <CardHeader
        title="Calendar links"
        description="A simple, free way to stop double bookings: the booking site reads which nights are taken with you, and you get the nights it sold."
        action={
          isAdmin && data ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add a calendar link
            </Button>
          ) : undefined
        }
      />
      <CardContent className="space-y-3">
        <Tip>
          A calendar link shares only <b>which nights are taken</b>: no prices and no guest details. The sites look at it every few hours, so it is <b>not instant</b>: a room sold here can still be
          sold on the site for a short while. It suits <b>one listing = one room</b> (Airbnb, Booking.com homes and apartments, Agoda Homes, Vrbo). MakeMyTrip and Goibibo do not offer calendar
          links for hotels: those need the full connection.
        </Tip>

        {failed && <Tip tone="danger">{failed}</Tip>}
        {!data && !failed && <Loading />}

        {data && calendars.length === 0 && (
          <p className="py-2 text-sm text-slate-600">
            No calendar links yet.{" "}
            {isAdmin ? "Press “Add a calendar link” and follow the two steps: it takes about five minutes for each listing." : "The owner or manager can add them."}
          </p>
        )}

        {calendars.length > 0 && (
          <ul className="divide-y divide-chrome-line border border-chrome-line">
            {calendars.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-1 basis-64 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                    {c.siteName}
                    <span className="font-normal text-slate-500">↔</span>
                    {whereOf(c)}
                    {c.name && <span className="font-normal text-slate-500">({c.name})</span>}
                    {!c.active && <Badge className="bg-amber-100 text-amber-800">Paused</Badge>}
                  </p>
                  {!c.active ? (
                    <p className="text-slate-600">Nothing is sent or read while this link is paused.</p>
                  ) : (
                    <>
                      {/* What we got from the site */}
                      {!c.importUrl ? (
                        <p className="text-amber-800">
                          Only sends your booked nights. Bookings made on {c.siteName} do not come in yet
                          {isAdmin ? (
                            <>
                              :{" "}
                              <button className="font-semibold underline" onClick={() => setStepsFor(c.id)}>
                                add {c.siteName}&apos;s link
                              </button>
                              .
                            </>
                          ) : (
                            "."
                          )}
                        </p>
                      ) : c.lastError ? (
                        <p className="flex items-start gap-1.5 font-semibold text-red-700">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            {c.siteName}&apos;s calendar could not be read{c.lastSyncAt ? ` (tried ${ago(c.lastSyncAt)})` : ""}. {c.lastError}
                          </span>
                        </p>
                      ) : c.lastSyncAt ? (
                        <p className="text-slate-700">
                          Read {ago(c.lastSyncAt)} · {count(c.lastEvents, "stay", "stays")}
                          {c.upcoming > 0 && ` · ${count(c.upcoming, "booking", "bookings")} to come in your bookings`}
                        </p>
                      ) : (
                        <p className="text-slate-600">{c.siteName}&apos;s calendar has not been read yet. Press Read now.</p>
                      )}
                      {/* Whether the site reads ours */}
                      {c.exportSeenAt ? (
                        <p className="flex items-center gap-1.5 text-slate-600">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                          {c.siteName} last read your link {ago(c.exportSeenAt)}
                        </p>
                      ) : (
                        <p className="text-amber-800">
                          {c.siteName} has not read your link yet.{" "}
                          <button className="font-semibold underline" onClick={() => setStepsFor(c.id)}>
                            Show me where to paste it
                          </button>
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => copy(fullLink(c))} title={`Copy the link that ${c.siteName} reads`}>
                    <Copy className="h-4 w-4" /> Copy our link
                  </Button>
                  {c.active && c.importUrl && (
                    <Button size="sm" variant="outline" loading={busy === `${c.id}:read`} onClick={() => read(c)} title={`Look at ${c.siteName}'s calendar now`}>
                      {busy !== `${c.id}:read` && <RefreshCw className="h-4 w-4" />} Read now
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setStepsFor(c.id)} title="The two steps, and the site's link">
                        <Link2 className="h-4 w-4" /> Set up
                      </Button>
                      <Button size="sm" variant="outline" loading={busy === `${c.id}:active`} onClick={() => setActive(c, !c.active)}>
                        {busy !== `${c.id}:active` && (c.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />)} {c.active ? "Pause" : "Resume"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-700" loading={busy === `${c.id}:remove`} onClick={() => remove(c)}>
                        {busy !== `${c.id}:remove` && <Trash2 className="h-4 w-4" />} Remove
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {adding && data && (
        <AddLink
          data={data}
          onClose={() => setAdding(false)}
          onAdded={async (c) => {
            setAdding(false);
            await load();
            setStepsFor(c.id);
            // With the site's link given, its bookings are brought in straight away.
            if (c.importUrl) await read(c);
            else onChanged?.();
          }}
        />
      )}
      {steps && (
        <LinkSteps
          key={steps.id}
          c={steps}
          isAdmin={isAdmin}
          copy={copy}
          onClose={() => setStepsFor(null)}
          onSaved={async (c) => {
            await load();
            if (c.importUrl) await read(c);
            else onChanged?.();
          }}
        />
      )}
    </Card>
  );
}

/** "Add a calendar link": the site, the room, and (if at hand) the site's own link. */
function AddLink({ data, onClose, onAdded }: { data: CalendarLinksDTO; onClose: () => void; onAdded: (c: CalendarLinkDTO) => void | Promise<void> }) {
  const { toast } = useApp();
  const [source, setSource] = useState("airbnb");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const site = siteName(source);

  async function save() {
    if (!target) return toast("Please choose the room this listing is for.", "error");
    setSaving(true);
    try {
      const [kind, value] = [target.slice(0, target.indexOf(":")), target.slice(target.indexOf(":") + 1)];
      const { calendar } = await api<{ calendar: CalendarLinkDTO }>("/api/channels/calendars", {
        body: { source, name: name.trim() || null, importUrl: importUrl.trim() || null, ...(kind === "room" ? { roomId: value } : { roomType: value }) },
      });
      toast("Calendar link added");
      await onAdded(calendar);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a calendar link"
      description="One link for each listing you have on a booking site."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save and show the next steps
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Booking site" hint="MakeMyTrip and Goibibo are not in this list: they do not offer calendar links for hotels.">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            {LINK_SITES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={`Which room is this listing on ${site}?`}
          hint="Choose one room when the listing is that one room. Choose a room type only when the site sells several of your rooms as one listing: its nights are then closed only when every room of the type is taken."
        >
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose…</option>
            <optgroup label="One room">
              {data.rooms.map((r) => (
                <option key={r.id} value={`room:${r.id}`}>
                  Room {r.roomNumber} ({label(r.type)})
                </option>
              ))}
            </optgroup>
            <optgroup label="All rooms of one type">
              {data.roomTypes.map((t) => (
                <option key={t} value={`type:${t}`}>
                  All {label(t)} rooms
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>
        <Field label={`${site}'s calendar link`} optional hint={`You can also paste it in the next step. Without it, ${site} sees your booked nights, but its bookings do not come in.`}>
          <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://…" autoComplete="off" inputMode="url" />
        </Field>
        <Field label="Name of the listing" optional hint="Only to tell your links apart, for example “Garden room on Airbnb”.">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </Field>
      </div>
    </Modal>
  );
}

/** The two steps that join a listing: our link goes to the site, the site's link comes here. */
function LinkSteps({
  c,
  isAdmin,
  copy,
  onClose,
  onSaved,
}: {
  c: CalendarLinkDTO;
  isAdmin: boolean;
  copy: (text: string) => void;
  onClose: () => void;
  onSaved: (c: CalendarLinkDTO) => void | Promise<void>;
}) {
  const { toast } = useApp();
  const [importUrl, setImportUrl] = useState(c.importUrl ?? "");
  const [saving, setSaving] = useState(false);
  const places = sitePlaces(c.source);
  const ours = fullLink(c);
  const changed = importUrl.trim() !== (c.importUrl ?? "");

  async function save() {
    setSaving(true);
    try {
      await api(`/api/channels/calendars/${c.id}`, { method: "PATCH", body: { importUrl: importUrl.trim() || null } });
      toast(importUrl.trim() ? `${c.siteName}'s link is saved` : `${c.siteName}'s link is removed`);
      await onSaved({ ...c, importUrl: importUrl.trim() || null });
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${c.siteName} ↔ ${whereOf(c)}`}
      description="Two steps. Do both, so that neither side sells a night the other already sold."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="font-bold text-slate-900">
            1. Copy this link and paste it on {c.siteName}
            {c.exportSeenAt && <span className="ml-2 font-semibold text-emerald-700">✓ {c.siteName} read it {ago(c.exportSeenAt)}</span>}
          </p>
          <div className="flex gap-2">
            <Input readOnly value={ours} onFocus={(e) => e.target.select()} aria-label="Our calendar link" className="font-mono text-xs" />
            <Button variant="outline" onClick={() => copy(ours)} className="shrink-0">
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>
          <p className="text-sm text-slate-600">{places.paste}</p>
          <p className="text-sm text-slate-600">
            {c.siteName} then closes the nights that are booked with you{c.roomNumber ? ` in Room ${c.roomNumber}` : ` when no ${label(c.roomType ?? "")} room is free`}. Keep this link to yourself:
            anyone who has it can see which nights are taken (never who the guests are).
          </p>
        </div>

        <div className="space-y-2 border-t border-chrome-line pt-4">
          <p className="font-bold text-slate-900">
            2. Copy {c.siteName}&apos;s link and paste it here
            {c.importUrl && !c.lastError && c.lastSyncAt && <span className="ml-2 font-semibold text-emerald-700">✓ read {ago(c.lastSyncAt)}</span>}
          </p>
          <p className="text-sm text-slate-600">{places.copy}</p>
          {isAdmin ? (
            <div className="flex gap-2">
              <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://…" autoComplete="off" inputMode="url" aria-label={`${c.siteName}'s calendar link`} />
              <Button onClick={save} loading={saving} disabled={!changed} className="shrink-0">
                Save
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">{c.importUrl ? "This link is saved." : "The owner or manager can paste it here."}</p>
          )}
          {c.lastError && c.importUrl && <Tip tone="danger">{c.lastError}</Tip>}
          <p className="text-sm text-slate-600">
            Stays sold on {c.siteName} then come into your bookings by themselves, and leave again when {c.siteName} cancels them. Calendar links carry no guest details, so the booking shows
            “{c.siteName} guest”: open {c.siteName} for the name and phone number, and type them into the booking.
          </p>
        </div>

        <Tip tone="warning">
          The sites look at calendars only every few hours. Just after a booking, the same night can still be sold on the other side for a short while. If that happens, a question appears on this
          page so you can move one of the two bookings.
        </Tip>
      </div>
    </Modal>
  );
}
