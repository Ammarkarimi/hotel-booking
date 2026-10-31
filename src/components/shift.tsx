"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Clock, Copy, LogOut, MessageCircle, NotebookPen, PlayCircle, StopCircle } from "lucide-react";
import { Button, Field, Input, Modal, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { durationLabel, shiftMessage, type ShiftSummary } from "@/lib/shift-report";
import { formatCurrency } from "@/lib/utils";
import type { CurrentShiftDTO, HandoverDTO, ShiftDTO } from "@/lib/types";

function timeOf(d: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(d));
}

function dayTimeOf(d: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(d));
}

/** Ticks every 30 seconds so the shift timer stays current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

async function signOut(router: ReturnType<typeof useRouter>) {
  await fetch("/api/auth/logout", { method: "POST" });
  router.push("/login");
  router.refresh();
}

/** The latest handover notes, newest first. */
export function HandoverNotes({ notes, timeZone, className }: { notes: HandoverDTO[]; timeZone: string; className?: string }) {
  if (!notes.length) return null;
  return (
    <div className={className}>
      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">
              {n.staffName} · shift ended {dayTimeOf(n.endedAt, timeZone)}
            </p>
            <p className="mt-1 whitespace-pre-line text-[15px] text-slate-900">{n.handoverNote}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryTiles({ s }: { s: ShiftSummary }) {
  const tiles = [
    { label: "Guest check-ins", value: String(s.checkIns) },
    { label: "Guest check-outs", value: String(s.checkOuts) },
    { label: "New bookings", value: String(s.bookingsMade) },
    { label: "Money received", value: formatCurrency(s.received) },
    { label: "Cash to hand over", value: formatCurrency(s.cashInHand) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold text-slate-500">{t.label}</p>
          <p className="text-lg font-bold text-slate-900">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

/** Blocks the app until a front-desk staff member starts their shift, and shows them the last handover notes first. */
function StartShiftGate({ current, onStarted }: { current: CurrentShiftDTO; onStarted: () => void }) {
  const { user, settings, toast } = useApp();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function start() {
    setSaving(true);
    try {
      await api("/api/shifts", { body: { startNote: note } });
      toast("Shift started. Have a good shift!");
      onStarted();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="start-shift-title">
      <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
            <PlayCircle className="h-7 w-7" />
          </div>
          <div>
            <h2 id="start-shift-title" className="text-xl font-bold text-slate-900">
              Hello {user.name.split(" ")[0]}, start your shift
            </h2>
            <p className="text-sm text-slate-500">Your check-ins, check-outs and payments are counted from now until you end the shift.</p>
          </div>
        </div>

        {current.handovers.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
              <NotebookPen className="h-4 w-4 text-amber-600" /> Please read the handover notes first
            </p>
            <HandoverNotes notes={current.handovers} timeZone={settings.timezone} />
          </div>
        ) : (
          <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">No handover notes from the last shift.</p>
        )}

        <Field label="Anything to note as you start?" optional hint="For example: cash in the drawer, a room that needs attention.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Cash in drawer ₹5,000" />
        </Field>

        <Button size="lg" className="mt-5 w-full" loading={saving} onClick={start}>
          <PlayCircle className="h-5 w-5" /> {current.handovers.length ? "I have read the notes, start my shift" : "Start my shift"}
        </Button>
        <button type="button" onClick={() => signOut(router)} className="mt-3 w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-800">
          Not you? Sign out
        </button>
      </div>
    </div>
  );
}

/** Ending a shift: a summary, a compulsory handover note and the code on screen, then the report to the owner on WhatsApp. */
function EndShiftDialog({ shift, ownerWhatsapp, open, onClose }: { shift: ShiftDTO; ownerWhatsapp: string | null; open: boolean; onClose: () => void }) {
  const { user, settings, toast } = useApp();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<ShiftSummary>(shift.summary);
  const [note, setNote] = useState("");
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [ended, setEnded] = useState<ShiftDTO | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open || ended) return;
    setTyped("");
    setCode(null);
    api<{ code: string; shift: ShiftDTO }>(`/api/shifts/${shift.id}/code`, { method: "POST" })
      .then((r) => {
        setCode(r.code);
        setSummary(r.shift.summary);
      })
      .catch((e) => toast((e as Error).message, "error"));
  }, [open, shift.id, ended, toast]);

  const noteOk = note.trim().length >= 5;
  const codeOk = !!code && typed.replace(/\s+/g, "").toUpperCase() === code;

  async function end() {
    setSaving(true);
    try {
      const done = await api<ShiftDTO>(`/api/shifts/${shift.id}/end`, { body: { handoverNote: note.trim(), code: typed } });
      setEnded(done);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const report = ended
    ? shiftMessage({
        hotelName: settings.hotelName,
        staffName: user.name,
        startedAt: ended.startedAt,
        endedAt: ended.endedAt!,
        timeZone: settings.timezone,
        summary: ended.summary,
        handoverNote: ended.handoverNote ?? "",
        currency: settings.currency,
      })
    : "";

  if (ended) {
    return (
      <Modal open={open} onClose={() => undefined} title="Shift ended" description={`${dayTimeOf(ended.startedAt, settings.timezone)} to ${timeOf(ended.endedAt!, settings.timezone)} · ${durationLabel(new Date(ended.endedAt!).getTime() - new Date(ended.startedAt).getTime())}`} size="lg">
        <div className="space-y-4">
          <SummaryTiles s={ended.summary} />
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Report for the owner</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-sm text-slate-800">{report}</pre>
          </div>
          {ownerWhatsapp ? (
            <a href={whatsappLink(ownerWhatsapp, report)} target="_blank" rel="noopener noreferrer" onClick={() => setSent(true)} className="block">
              <Button size="lg" variant="success" className="w-full">
                <MessageCircle className="h-5 w-5" /> Send to owner on WhatsApp
              </Button>
            </a>
          ) : (
            <>
              <Tip tone="warning">The owner&apos;s WhatsApp number is not set yet (Settings → Staff). Copy the report and send it to the owner.</Tip>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard?.writeText(report).then(() => toast("Report copied")).catch(() => undefined);
                  setSent(true);
                }}
              >
                <Copy className="h-5 w-5" /> Copy the report
              </Button>
            </>
          )}
          <Button size="lg" variant={sent ? "primary" : "outline"} className="w-full" disabled={!sent} onClick={() => signOut(router)}>
            <LogOut className="h-5 w-5" /> {sent ? "Sign out" : "Send the report to the owner first"}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="End your shift"
      description={`Started ${dayTimeOf(shift.startedAt, settings.timezone)} · ${durationLabel(Date.now() - new Date(shift.startedAt).getTime())} so far`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Not yet
          </Button>
          <Button variant="danger" onClick={end} loading={saving} disabled={!noteOk || !codeOk}>
            <StopCircle className="h-5 w-5" /> End shift
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SummaryTiles s={summary} />
        <Field label="Handover note for the next person" hint="Compulsory. Anything they must know: promises made to guests, money to collect, rooms to watch.">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Room 203 guest is staying 2 hours more and will pay ₹500 at check-out."
          />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-700">Type this code to confirm</p>
          <div className="flex flex-wrap items-center gap-3">
            <div aria-label={code ? `Code ${code.split("").join(" ")}` : "Preparing code"} className="flex select-none gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-2" onCopy={(e) => e.preventDefault()}>
              {(code ?? "······").split("").map((c, i) => (
                <span key={i} className="w-6 text-center font-mono text-2xl font-bold tracking-wider text-slate-900">
                  {c}
                </span>
              ))}
            </div>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              onPaste={(e) => e.preventDefault()}
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Type the code"
              placeholder="Type the code"
              className="w-44 font-mono text-lg tracking-widest"
            />
          </div>
          {typed.length >= 6 && !codeOk && <p className="mt-1 text-sm text-red-600">The code does not match.</p>}
        </div>
      </div>
    </Modal>
  );
}

/** In the top bar: the shift timer and the End shift button, or the start-shift screen when no shift is running. */
export function ShiftControl() {
  const { user, settings } = useApp();
  const now = useNow();
  const [current, setCurrent] = useState<CurrentShiftDTO | null>(null);
  const [ending, setEnding] = useState(false);

  const load = useCallback(() => {
    api<CurrentShiftDTO>("/api/shifts/current").then(setCurrent).catch(() => undefined);
  }, []);
  useEffect(() => load(), [load]);

  if (user.role === "admin" || !current) return null;
  // Pop-ups go straight on the page: the top bar's blur would otherwise trap them inside it.
  if (!current.shift) return current.required ? createPortal(<StartShiftGate current={current} onStarted={load} />, document.body) : null;

  const since = new Date(current.shift.startedAt).getTime();
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="hidden items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 md:flex" title={`On shift since ${timeOf(current.shift.startedAt, settings.timezone)}`}>
          <Clock className="h-4 w-4" /> On shift · {durationLabel(now - since)}
        </span>
        <Button variant="outline" onClick={() => setEnding(true)} className="whitespace-nowrap" aria-label="End shift">
          <StopCircle className="h-5 w-5 text-red-600" />
          <span className="hidden sm:inline">End shift</span>
          <span className="sm:hidden">{durationLabel(now - since)}</span>
        </Button>
      </div>
      {ending && createPortal(<EndShiftDialog shift={current.shift} ownerWhatsapp={current.ownerWhatsapp} open={ending} onClose={() => setEnding(false)} />, document.body)}
    </>
  );
}
