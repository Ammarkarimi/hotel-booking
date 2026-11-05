"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCopy, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Loading, Modal, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { PATHIK_ADD_URL, type PathikRecord } from "@/lib/pathik";
import { VEHICLE_LABELS } from "@/lib/guest-form";
import type { SettingsDTO } from "@/lib/types";
import { cn, formatDateTime, label } from "@/lib/utils";

/** The Pathik helper add-on for Chrome, built from the pathik-helper folder at deploy time. */
export const HELPER_ZIP = "/pathik-helper.zip";

/** `bookingId`: the stay the details are for (for a guest, their current stay, if any). */
type PathikData = PathikRecord & { bookingId: string | null; pathikAt: string | null; pathikByName: string | null };

/** The add-on marks every page of this software when it is installed. */
function useHelperVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setVersion(document.documentElement.dataset.pathikHelper ?? null);
    read();
    window.addEventListener("pathik-helper:ready", read);
    return () => window.removeEventListener("pathik-helper:ready", read);
  }, []);
  return version;
}

const dmy = (key: string) => (key ? `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}` : "");

/** Every value, in the order of Pathik's form, for copying one by one when the add-on is not installed. */
function copyRows(r: PathikRecord): Array<[string, string]> {
  const g = r.guest;
  const rows: Array<[string, string]> = [
    ["First name", g.firstName],
    ["Middle name", g.middleName],
    ["Last name", g.lastName],
    ["Company", g.company],
    ["Address", g.address],
    ["Locality", g.locality],
    ["City", g.city],
    ["District", g.district],
    ["PIN code", g.zipCode],
    ["Country", g.country],
    ["State", g.state],
    ["Date of birth", dmy(g.dateOfBirth)],
    ["Mobile", g.mobile],
    ["Email", g.email],
    ["Document type", g.docType ? label(g.docType) : ""],
    ["Document number", g.docNumber],
  ];
  if (r.stay) {
    const s = r.stay;
    rows.push(
      ["Coming from", s.comingFrom],
      ["Going to", s.goingTo],
      ["Room number", s.roomNumber],
      ["Check-in date", dmy(s.checkInDate)],
      ["Check-in time", s.checkInTime],
      ["Check-out date", dmy(s.checkOutDate)],
      ["Check-out time", s.checkOutTime],
      ["Adults", String(s.adults)],
      ["Children", String(s.children)],
      ["Vehicle type", s.vehicleType ? VEHICLE_LABELS[s.vehicleType as keyof typeof VEHICLE_LABELS] ?? s.vehicleType : ""],
      ["Vehicle number", s.vehicleNumber]
    );
    r.others.forEach((o, i) => rows.push([`Adult ${i + 2}`, [o.fullName, o.mobile, o.docType ? label(o.docType) : ""].filter(Boolean).join(" · ")]));
  }
  return rows.filter(([, v]) => v);
}

/**
 * "Fill in Pathik": checks what the police form still needs, then hands the details to the
 * Pathik helper add-on, which opens Pathik's Add Guest form and fills it in. Aadhaar is typed by hand.
 */
export function PathikDialog({ open, onClose, bookingId, guestId, onChanged }: { open: boolean; onClose: () => void; bookingId?: string; guestId?: string; onChanged?: () => void }) {
  const { toast, settings } = useApp();
  const helper = useHelperVersion();
  const [data, setData] = useState<PathikData | null>(null);
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const [showCopy, setShowCopy] = useState(false);

  const load = useCallback(() => {
    setData(null);
    api<PathikData>(`/api/pathik?${bookingId ? `bookingId=${bookingId}` : `guestId=${guestId}`}`)
      .then(setData)
      .catch((e) => toast(e.message, "error"));
  }, [bookingId, guestId, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // The add-on answers once it has opened Pathik (or says what went wrong).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.data?.source !== "pathik-helper") return;
      if (e.data.type === "pathik:opened") {
        setSending(false);
        toast("Pathik is open in a new tab. Check the form, add the Aadhaar by hand, then press Submit there.");
      } else if (e.data.type === "pathik:error") {
        setSending(false);
        toast(e.data.message || "The Pathik helper could not open Pathik", "error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [toast]);

  function fill() {
    if (!data) return;
    setSending(true);
    window.postMessage({ source: "hotel-manager", type: "pathik:fill", record: data }, window.location.origin);
    setTimeout(() => setSending(false), 20000);
  }

  async function mark(entered: boolean) {
    if (!data?.bookingId) return;
    setMarking(true);
    try {
      const r = await api<{ pathikAt: string | null; pathikByName: string | null }>(`/api/bookings/${data.bookingId}/pathik`, { body: { entered } });
      setData((d) => (d ? { ...d, ...r } : d));
      toast(entered ? "Marked as entered in Pathik" : "Pathik mark removed");
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setMarking(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast("Could not copy. Please select the text and copy it.", "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Fill in Pathik" description={data?.title ?? "Police guest register"}>
      {!data ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {data.missing.length > 0 && (
            <Tip tone="warning">
              <b>Pathik also asks for:</b> {data.missing.join(", ")}. Add {data.missing.length === 1 ? "it" : "them"} here first ({bookingId ? "Change booking or the guest's profile" : "Edit guest"}), or type {data.missing.length === 1 ? "it" : "them"} in Pathik.
            </Tip>
          )}
          {data.byHand.length > 0 && (
            <Tip>
              <b>Type in Pathik by hand:</b> {data.byHand.join("; ")}. Nothing from an Aadhaar is saved in this software.
            </Tip>
          )}

          {helper ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">
                Pathik opens in a new tab and the Add Guest form is filled in{data.others.length ? `, with the ${data.others.length + 1} adults` : ""}
                {data.documents.length ? ` and ${data.documents.length} ID ${data.documents.length === 1 ? "copy" : "copies"} (made smaller than 250 KB)` : ""}. Sign in to Pathik first if it asks. Check everything, then press <b>Submit</b> in Pathik.
              </p>
              <Button className="mt-3 w-full sm:w-auto" onClick={fill} loading={sending}>
                <ExternalLink className="h-4 w-4" /> Open Pathik and fill the form
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Fill Pathik automatically with the Pathik helper</p>
              <p className="mt-1">It is a small add-on for Google Chrome on the front-desk computer. Install it once:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  <a href={HELPER_ZIP} download className="inline-flex items-center gap-1 font-semibold text-primary-700 underline">
                    <Download className="h-4 w-4" /> Download the Pathik helper
                  </a>{" "}
                  and unzip it (right-click → Extract all).
                </li>
                <li>
                  In Chrome open <b>chrome://extensions</b>, turn on <b>Developer mode</b> (top right).
                </li>
                <li>
                  Press <b>Load unpacked</b> and choose the unzipped <b>pathik-helper</b> folder.
                </li>
                <li>Come back here and reload the page. This box then shows a button that fills Pathik for you.</li>
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={PATHIK_ADD_URL} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" /> Open Pathik
                  </Button>
                </a>
                <Button variant="outline" size="sm" onClick={() => setShowCopy((v) => !v)}>
                  <ClipboardCopy className="h-4 w-4" /> {showCopy ? "Hide details" : "Copy details one by one"}
                </Button>
              </div>
            </div>
          )}

          {(showCopy || helper) && (
            <details open={showCopy} className="rounded-xl border border-slate-200">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-slate-700">Details for Pathik</summary>
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {copyRows(data).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-4 py-1.5 text-sm">
                    <span className="w-32 shrink-0 text-slate-500">{k}</span>
                    <span className="min-w-0 flex-1 break-words font-medium text-slate-900">{v}</span>
                    <button type="button" onClick={() => copy(v, k)} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={`Copy ${k}`}>
                      <ClipboardCopy className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {data.bookingId && (
            <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl p-4", data.pathikAt ? "bg-emerald-50" : "bg-slate-50")}>
              <p className="text-sm">
                {data.pathikAt ? (
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> Entered in Pathik{data.pathikByName ? ` by ${data.pathikByName}` : ""}, {formatDateTime(data.pathikAt, settings.timezone)}
                  </span>
                ) : (
                  <span className="text-slate-700">After you press Submit in Pathik, mark this stay as entered.</span>
                )}
              </p>
              {data.pathikAt ? (
                <Button variant="ghost" size="sm" onClick={() => mark(false)} loading={marking}>
                  Remove mark
                </Button>
              ) : (
                <Button variant="success" size="sm" onClick={() => mark(true)} loading={marking}>
                  <CheckCircle2 className="h-4 w-4" /> Entered in Pathik
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** The button that opens "Fill in Pathik". Hidden when the hotel has switched Pathik off in Settings. */
export function PathikButton({ bookingId, guestId, onChanged, entered, className, size = "sm" }: { bookingId?: string; guestId?: string; onChanged?: () => void; entered?: boolean; className?: string; size?: "sm" | "md" }) {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  if (!settings.pathik) return null;
  return (
    <>
      <Button variant="outline" size={size} className={className} onClick={() => setOpen(true)}>
        {entered ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ShieldCheck className="h-4 w-4" />} {entered ? "Entered in Pathik" : "Fill in Pathik"}
      </Button>
      <PathikDialog open={open} onClose={() => setOpen(false)} bookingId={bookingId} guestId={guestId} onChanged={onChanged} />
    </>
  );
}

/** Settings → Hotel details: show "Fill in Pathik" (hotels outside Gujarat do not use Pathik). */
export function PathikSettings({ s, set }: { s: SettingsDTO; set: (p: Partial<SettingsDTO>) => void }) {
  return (
    <Card className="mb-6">
      <CardHeader title="Police guest register (Pathik)" description="Hotels in Gujarat enter every guest in Pathik (pathik.guru)." />
      <CardContent className="space-y-3">
        <Toggle
          checked={s.pathik}
          onChange={(pathik) => set({ pathik })}
          label="Show “Fill in Pathik”"
          description="On each booking and guest. With the Pathik helper add-on in Chrome, Pathik's Add Guest form is filled in for you, including the other adults. Aadhaar numbers are typed by hand."
        />
        <a href={HELPER_ZIP} download className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 underline">
          <Download className="h-4 w-4" /> Download the Pathik helper for Chrome
        </a>
      </CardContent>
    </Card>
  );
}
