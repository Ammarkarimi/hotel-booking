"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Lightbulb, TrendingDown } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Loading, Modal, NumberInput, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { clockLabel } from "@/lib/messages";
import { MIN_HISTORY_DAYS, SEEN_TEXT, isSeenText, roundPrice, type RateTip } from "@/lib/rate-tips";
import { formatCurrency, formatDate, label } from "@/lib/utils";
import type { RateTipsDTO, SettingsDTO } from "@/lib/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function rooms(n: number) {
  return `${n} room${n === 1 ? "" : "s"}`;
}

/** Why this price: what is free, what usually still sells, and what the history shows. */
export function tipReasons(tip: RateTip, from: string) {
  const day = DAY_NAMES[new Date(`${tip.date}T00:00:00Z`).getUTCDay()];
  const empty = Math.max(1, Math.round(tip.free - tip.expected));
  const lines = [
    tip.expected >= 0.5
      ? `On a usual ${day} about ${Math.round(tip.expected)} more ${tip.expected >= 1.5 ? "get" : "gets"} booked for the same night from now on, so about ${rooms(empty)} may stay empty.`
      : `On a usual ${day} hardly any ${label(tip.type)} room gets booked for the same night this late, so ${tip.free === 1 ? "it" : "they"} may stay empty.`,
  ];
  if (tip.lateSales.count > 0)
    lines.push(
      `In the last ${tip.historyDays} days, ${rooms(tip.lateSales.count)} of this type ${tip.lateSales.count === 1 ? "was" : "were"} booked after ${clockLabel(from)} for the same night${tip.lateSales.averageRate ? `, at ${formatCurrency(tip.lateSales.averageRate)} on average` : ""}.`
    );
  if (tip.historyDays < MIN_HISTORY_DAYS) lines.push("There are only a few days of bookings so far, so this tip goes mostly by the time of day.");
  if (tip.floor !== null && tip.price === tip.floor) lines.push(`This is the lowest price you set for ${label(tip.type)} rooms.`);
  return lines;
}

/** One tip: the room type, free rooms, the usual and the suggested price, and why. */
export function TipCard({ tip, from }: { tip: RateTip; from: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-slate-900">{label(tip.type)} rooms</p>
          <p className="text-sm text-slate-600">
            {tip.free} of {tip.sellable} still free for tonight
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 line-through">{formatCurrency(tip.usualPrice)}</p>
          <p className="flex items-center gap-1 text-2xl font-extrabold text-emerald-700">
            <TrendingDown className="h-5 w-5" /> {formatCurrency(tip.price)}
          </p>
          <p className="text-xs font-semibold text-emerald-700">{tip.discount}% less, per night</p>
        </div>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {tipReasons(tip, from).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Rate tips pop up for everyone who should see them (owner, and the front desk if the owner
 * allows), and stay until the person types "I have seen". Checked every 5 minutes.
 */
export function RateTipPopup() {
  const { toast, isAdmin } = useApp();
  const pathname = usePathname();
  const [data, setData] = useState<RateTipsDTO | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<RateTipsDTO>("/api/rate-tips")
      .then(setData)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  const tips = data?.unseen ?? [];
  // Not on the printed pages, and not while the person is already reading the tips page.
  if (!data || tips.length === 0 || pathname.startsWith("/print")) return null;

  async function confirmSeen(e: React.FormEvent) {
    e.preventDefault();
    if (!isSeenText(text)) return;
    setSaving(true);
    try {
      await api("/api/rate-tips", { body: { keys: tips.map((t) => t.key), text } });
      setText("");
      setData({ ...data!, unseen: [] });
      window.dispatchEvent(new Event("rate-tips-seen"));
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      hideClose
      onClose={() => undefined}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" /> Rate tip for tonight, {formatDate(tips[0].date)}
        </span>
      }
      description="Some rooms will probably stay empty tonight. A lower price may get them sold."
      footer={
        <form onSubmit={confirmSeen} className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
            Type <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{SEEN_TEXT}</span> to close
            <Input className="mt-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={SEEN_TEXT} autoComplete="off" aria-label={`Type ${SEEN_TEXT} to close`} />
          </label>
          <Button type="submit" loading={saving} disabled={!isSeenText(text)}>
            Close
          </Button>
        </form>
      }
    >
      <div className="space-y-3">
        {tips.map((t) => (
          <TipCard key={t.key} tip={t} from={data.from} />
        ))}
        <p className="text-sm text-slate-600">
          Offer these prices to walk-ins and phone calls tonight{isAdmin ? ", and on booking sites if you sell there" : ""}. In <b>New booking</b> the tip
          shows next to the price. Nothing changes by itself. All room types are under <b>Rate tips</b> in the menu.
        </p>
      </div>
    </Modal>
  );
}

/** Settings → Rate tips: when tips start, the biggest cut, the lowest price per room type, and who sees them. */
export function RateTipSettings({ s, set }: { s: SettingsDTO; set: (p: Partial<SettingsDTO>) => void }) {
  const [types, setTypes] = useState<Array<{ type: string; count: number; price: number }> | null>(null);
  useEffect(() => {
    api<Array<{ type: string; pricePerNight: number }>>("/api/rooms")
      .then((rooms) => {
        const by = new Map<string, number[]>();
        for (const r of rooms) by.set(r.type, [...(by.get(r.type) ?? []), r.pricePerNight]);
        setTypes(
          [...by.entries()]
            .map(([type, prices]) => ({ type, count: prices.length, price: Math.min(...prices) }))
            .sort((a, b) => a.price - b.price)
        );
      })
      .catch(() => setTypes([]));
  }, []);
  const floors = s.rateTipsFloors ?? {};
  const setFloor = (type: string, v: number | null) => {
    const next = { ...floors };
    if (v && v > 0) next[type] = v;
    else delete next[type];
    set({ rateTipsFloors: next });
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader title="Rate tips" description="When rooms are still empty for tonight later in the day, the software suggests a lower price so they get sold." />
        <CardContent className="space-y-5">
          <Toggle checked={s.rateTips} onChange={(rateTips) => set({ rateTips })} label="Show rate tips" description="A pop-up shows the tip. It stays until the person types “I have seen”. Prices never change by themselves." />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Start tips at" hint="Before this time rooms sell at the usual price. Tips get lower 4 and 7 hours later.">
              <Input type="time" value={s.rateTipsFrom} onChange={(e) => set({ rateTipsFrom: e.target.value })} className="max-w-[10rem]" />
            </Field>
            <Field label="Biggest cut a tip may suggest (%)" hint="Late at night, or when half the rooms of a type are still free.">
              <div className="max-w-[13rem]">
                <NumberInput min={0} max={60} value={s.rateTipsMaxDiscount} onChange={(v) => set({ rateTipsMaxDiscount: v ?? 0 })} aria-label="Biggest cut in percent" />
              </div>
            </Field>
          </div>
          <Toggle
            checked={s.rateTipsStaff}
            onChange={(rateTipsStaff) => set({ rateTipsStaff })}
            label="Front-desk staff see the tips too"
            description="So they can offer the price to walk-ins and callers. Turn off to see the tips yourself only."
          />
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader title="Lowest price per room type" description="A tip never goes below this. Leave empty to allow the full cut above." />
        <CardContent>
          {!types ? (
            <Loading />
          ) : types.length === 0 ? (
            <p className="text-sm text-slate-500">Add rooms first.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {types.map((t) => (
                <div key={t.type} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{label(t.type)}</p>
                    <p className="text-sm text-slate-500">
                      {t.count} room{t.count === 1 ? "" : "s"} · usual price from {formatCurrency(t.price)} · biggest cut gives{" "}
                      {formatCurrency(roundPrice(t.price * (1 - s.rateTipsMaxDiscount / 100)))}
                    </p>
                  </div>
                  <div className="w-40">
                    <NumberInput min={0} value={floors[t.type] ?? null} onChange={(v) => setFloor(t.type, v)} placeholder="No limit" aria-label={`Lowest price for ${label(t.type)} rooms`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
