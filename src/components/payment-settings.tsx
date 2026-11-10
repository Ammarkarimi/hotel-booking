"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Tip } from "@/components/ui";
import { isUpiId } from "@/lib/online-payments";
import { DEFAULT_TALLY_LEDGERS, TALLY_LEDGER_INFO, TALLY_LEDGER_KEYS } from "@/lib/tally";
import type { SettingsDTO } from "@/lib/types";

type Props = { s: SettingsDTO; set: (p: Partial<SettingsDTO>) => void };

/** Settings → Payments & Tally: the hotel's UPI ID and Razorpay keys. */
export function OnlinePaymentSettings({ s, set }: Props) {
  const [changingKeys, setChangingKeys] = useState(!s.razorpayKeyId);
  const upiWrong = !!s.upiId?.trim() && !isUpiId(s.upiId);
  return (
    <Card className="mb-6">
      <CardHeader
        title="Online payments"
        description="Guests pay from a link sent on WhatsApp: by UPI straight to your account, or by UPI, card or net banking through Razorpay."
      />
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <p className="font-semibold text-slate-800">1. UPI to your own account (no charges)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your UPI ID" htmlFor="upi-id" optional hint={upiWrong ? <span className="font-semibold text-red-600">This does not look like a UPI ID. It looks like name@bank.</span> : "The ID your bank or UPI app shows, e.g. sunrise@okaxis or 9876543210@ybl."}>
              <Input id="upi-id" value={s.upiId ?? ""} onChange={(e) => set({ upiId: e.target.value.trim() })} placeholder="sunrise@okaxis" autoComplete="off" />
            </Field>
            <Field label="Name shown to the guest" htmlFor="upi-name" optional hint="Leave empty to use the hotel name.">
              <Input id="upi-name" value={s.upiName ?? ""} onChange={(e) => set({ upiName: e.target.value })} placeholder={s.hotelName} maxLength={50} />
            </Field>
          </div>
          <Tip>
            The guest scans a QR code (or taps a button on their phone) and their UPI app opens with the amount filled in. The money comes straight to you. UPI does not tell the software when
            the guest has paid, so check your bank or UPI app and press <b>Take payment</b> on the booking, as you do today. The QR code is also printed on bills that still have money to pay.
          </Tip>
        </div>

        <div className="space-y-4 border-t border-slate-100 pt-5">
          <p className="font-semibold text-slate-800">2. Razorpay (UPI, cards, net banking: marked as paid by itself)</p>
          {s.razorpayKeyId && !changingKeys ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              <span>
                Connected with key <b>{s.razorpayKeyId}</b>
                {s.razorpayKeyId.startsWith("rzp_test_") && " (test mode: no real money)"}
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setChangingKeys(true)}>
                  Change keys
                </Button>
                <Button size="sm" variant="outline" onClick={() => set({ razorpayKeyId: null, razorpayKeySecret: "" })}>
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Key ID" htmlFor="rzp-key-id" optional hint="Starts with rzp_live_">
                <Input id="rzp-key-id" value={s.razorpayKeyId ?? ""} onChange={(e) => set({ razorpayKeyId: e.target.value.trim() || null })} placeholder="rzp_live_…" autoComplete="off" />
              </Field>
              <Field label="Key secret" htmlFor="rzp-key-secret" optional hint={s.razorpaySecretSet ? "Leave empty to keep the saved secret." : "Shown once when you make the key in Razorpay."}>
                <Input
                  id="rzp-key-secret"
                  type="password"
                  value={s.razorpayKeySecret ?? ""}
                  onChange={(e) => set({ razorpayKeySecret: e.target.value.trim() })}
                  autoComplete="new-password"
                  placeholder={s.razorpaySecretSet ? "••••••••" : ""}
                />
              </Field>
            </div>
          )}
          <Tip>
            In your Razorpay dashboard open <b>Account &amp; Settings → API keys</b> and generate a key, then paste both here and press Save. The software checks them with Razorpay first. The
            secret is kept locked (encrypted) and is never shown again. Razorpay charges its own fee on each payment (about 2%). Payments made through the link are added to the booking by
            themselves, with Razorpay&apos;s payment ID as the reference.{" "}
            <a href="https://dashboard.razorpay.com/app/website-app-settings/api-keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
              Open Razorpay API keys <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Tip>
        </div>
      </CardContent>
    </Card>
  );
}

/** Settings → Payments & Tally: the ledger names used in the Tally files. */
export function TallySettings({ s, set }: Props) {
  const ledgers = { ...DEFAULT_TALLY_LEDGERS, ...s.tallyLedgers };
  return (
    <Card className="mb-6">
      <CardHeader
        title="Tally ledger names"
        description="Reports → Download for Tally makes files your accountant imports into TallyPrime. Use the same ledger names as in your Tally company; any that do not exist yet are created."
      />
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {TALLY_LEDGER_KEYS.map((k) => (
          <Field key={k} label={TALLY_LEDGER_INFO[k].label} htmlFor={`tally-${k}`} hint={`${TALLY_LEDGER_INFO[k].hint}. Group: ${TALLY_LEDGER_INFO[k].group}.`}>
            <Input
              id={`tally-${k}`}
              value={ledgers[k]}
              onChange={(e) => set({ tallyLedgers: { ...ledgers, [k]: e.target.value } })}
              placeholder={DEFAULT_TALLY_LEDGERS[k]}
              maxLength={100}
            />
          </Field>
        ))}
      </CardContent>
    </Card>
  );
}
