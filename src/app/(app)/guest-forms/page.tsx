"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BedDouble, ClipboardCheck, MessageCircle, RefreshCw, Send, X } from "lucide-react";
import { Badge, Button, Card, CardContent, EmptyState, Loading, Modal, PageHeader, Tabs } from "@/components/ui";
import { FormDetails, SendGuestFormDialog, SendLink } from "@/components/guest-form-send";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { GuestFormDTO } from "@/lib/types";

type View = "received" | "waiting" | "done";

function title(f: GuestFormDTO) {
  return f.details ? `${f.details.firstName} ${f.details.lastName}`.trim() : f.guestName || f.phone;
}

export default function GuestFormsPage() {
  const { confirm, toast } = useApp();
  const [view, setView] = useState<View>("received");
  const [forms, setForms] = useState<GuestFormDTO[] | null>(null);
  const [counts, setCounts] = useState<{ received: number } | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [resent, setResent] = useState<GuestFormDTO | null>(null);

  const load = useCallback(() => {
    api<GuestFormDTO[]>(`/api/guest-forms?view=${view}`)
      .then(setForms)
      .catch((e) => toast(e.message, "error"));
    api<{ received: number }>("/api/guest-forms?count=1").then(setCounts).catch(() => undefined);
  }, [view, toast]);

  useEffect(() => {
    setForms(null);
    load();
    // New forms arrive while the screen is open.
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function close(f: GuestFormDTO) {
    const ok = await confirm({
      title: `Close the form for ${title(f)}?`,
      message: f.status === "submitted" ? "The details and ID copies the guest sent will be deleted." : "The link will stop working.",
      confirmText: "Yes, close it",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/guest-forms/${f.id}`, { body: { action: "cancel" } });
      toast("Form closed");
      window.dispatchEvent(new Event("guest-forms-changed"));
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function resend(f: GuestFormDTO) {
    try {
      setResent(await api<GuestFormDTO>(`/api/guest-forms/${f.id}`, { body: { action: "resend" } }));
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Guest forms"
        description="Send a form on WhatsApp. The guest fills in their details and uploads ID copies; you choose the room."
        actions={
          <Button onClick={() => setSendOpen(true)}>
            <Send className="h-5 w-5" /> Send a form
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        value={view}
        onChange={setView}
        tabs={[
          { value: "received", label: "Filled in, need a room", count: counts?.received },
          { value: "waiting", label: "Waiting for the guest" },
          { value: "done", label: "Booked & closed" },
        ]}
      />

      {!forms ? (
        <Loading />
      ) : forms.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title={view === "received" ? "No filled-in forms waiting" : view === "waiting" ? "No forms waiting for a guest" : "Nothing here yet"}
          description={view === "received" ? "When a guest sends their form it shows here, and the menu shows a red number." : undefined}
          action={
            view !== "done" && (
              <Button variant="outline" onClick={() => setSendOpen(true)}>
                <Send className="h-4 w-4" /> Send a form
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {forms.map((f) => (
            <Card key={f.id}>
              <CardContent className="space-y-4 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-lg font-bold">
                      {title(f)}
                      {f.status === "expired" && <Badge variant="warning">Link expired</Badge>}
                      {f.status === "booked" && <Badge variant="success">Booked</Badge>}
                      {f.status === "cancelled" && <Badge>Closed</Badge>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {f.phone} · sent by {f.sentByName} {formatDateTime(f.createdAt)}
                      {f.submittedAt && ` · filled in ${formatDateTime(f.submittedAt)}`}
                    </p>
                    {f.status === "sent" && <p className="text-sm text-slate-500">The link works until {formatDate(f.expiresAt.slice(0, 10))}.</p>}
                    {f.status === "cancelled" && f.closedBy && <p className="text-sm text-slate-500">Closed by {f.closedBy}.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {f.status === "submitted" && (
                      <Link href={`/bookings/new?form=${f.id}`}>
                        <Button>
                          <BedDouble className="h-5 w-5" /> Choose room & book
                        </Button>
                      </Link>
                    )}
                    {(f.status === "sent" || f.status === "expired") && (
                      <Button variant="success" onClick={() => resend(f)}>
                        {f.status === "expired" ? <RefreshCw className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />} Send again
                      </Button>
                    )}
                    {f.status === "booked" && f.bookingId && (
                      <Link href={`/bookings/${f.bookingId}`}>
                        <Button variant="outline">Open booking</Button>
                      </Link>
                    )}
                    {(f.status === "submitted" || f.status === "sent" || f.status === "expired") && (
                      <Button variant="ghost" onClick={() => close(f)}>
                        <X className="h-4 w-4" /> Close
                      </Button>
                    )}
                  </div>
                </div>
                {f.status === "submitted" && <FormDetails form={f} />}
                {f.status === "sent" && (f.checkIn || f.guestName) && (
                  <p className="text-sm text-slate-600">{f.checkIn && f.checkOut ? `Dates suggested: ${formatDate(f.checkIn)} → ${formatDate(f.checkOut)}` : ""}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SendGuestFormDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onSent={() => {
          if (view === "waiting") load();
        }}
      />
      <Modal open={!!resent} onClose={() => setResent(null)} title="Send the form again">
        {resent && <SendLink form={resent} onDone={() => setResent(null)} />}
      </Modal>
    </div>
  );
}
