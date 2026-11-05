"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, NumberInput, PageHeader, Select, Textarea, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { FOOD_TYPES } from "@/lib/banquet-bill";
import type { BanquetDefaults, BanquetHallDTO, BanquetMenuDTO, BanquetSetup } from "@/lib/banquet-types";
import { formatCurrency, label } from "@/lib/utils";

type HallDraft = { id?: string; name: string; capacity: number | null; rent: number | null; notes: string; active: boolean };
type MenuDraft = { id?: string; name: string; foodType: string; pricePerPlate: number | null; items: string; active: boolean };

export default function BanquetSetupPage() {
  const { isAdmin, toast, confirm } = useApp();
  const [setup, setSetup] = useState<BanquetSetup | null>(null);
  const [hall, setHall] = useState<HallDraft | null>(null);
  const [menu, setMenu] = useState<MenuDraft | null>(null);
  const [defaults, setDefaults] = useState<(Omit<BanquetDefaults, "foodGst" | "hallGst" | "itemGst"> & { foodGst: number | null; hallGst: number | null; itemGst: number | null }) | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<BanquetSetup>("/api/banquets/setup").then((s) => {
      setSetup(s);
      setDefaults(s.defaults);
    });
  }, []);
  useEffect(load, [load]);

  if (!isAdmin) return <EmptyState title="Halls and menus are set by the owner / manager" />;
  if (!setup || !defaults) return <Loading />;

  async function save(url: string, body: object, method: string, done: string) {
    setBusy(true);
    try {
      await api(url, { method, body });
      toast(done);
      setHall(null);
      setMenu(null);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeHall(h: BanquetHallDTO) {
    if (await confirm({ title: `Delete ${h.name}?`, confirmText: "Delete", danger: true })) save(`/api/banquets/halls?id=${h.id}`, {}, "DELETE", "Hall deleted");
  }
  async function removeMenu(m: BanquetMenuDTO) {
    if (await confirm({ title: `Delete the menu “${m.name}”?`, message: "Functions already booked keep their copy of it.", confirmText: "Delete", danger: true }))
      save(`/api/banquets/menus?id=${m.id}`, {}, "DELETE", "Menu deleted");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Halls & menus"
        description="Your halls with their usual rent, your menus with the price per plate, and the GST on functions."
        actions={
          <Link href="/banquets">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Banquets
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader
          title={`Halls (${setup.halls.length})`}
          description="Each place a function can be held: hall, lawn, terrace, meeting room."
          action={
            <Button size="sm" onClick={() => setHall({ name: "", capacity: null, rent: null, notes: "", active: true })}>
              <Plus className="h-4 w-4" /> Add hall
            </Button>
          }
        />
        {setup.halls.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">No halls yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {setup.halls.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-semibold">
                    {h.name} {!h.active && <Badge>Switched off</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {h.capacity ? `Up to ${h.capacity} guests · ` : ""}rent {formatCurrency(h.rent)}
                    {h.notes && ` · ${h.notes}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label={`Change ${h.name}`} onClick={() => setHall({ ...h, notes: h.notes ?? "" })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${h.name}`} onClick={() => removeHall(h)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Menus (${setup.menus.length})`}
          description="Packages with a price per plate. Choosing one on a function fills in its price and dishes."
          action={
            <Button size="sm" onClick={() => setMenu({ name: "", foodType: "veg", pricePerPlate: null, items: "", active: true })}>
              <Plus className="h-4 w-4" /> Add menu
            </Button>
          }
        />
        {setup.menus.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">No menus yet. You can still type a price per plate on each function.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {setup.menus.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {m.name} <Badge variant={m.foodType === "veg" || m.foodType === "jain" ? "success" : "danger"}>{label(m.foodType)}</Badge>{" "}
                    {!m.active && <Badge>Switched off</Badge>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {formatCurrency(m.pricePerPlate)} a plate{m.items ? ` · ${m.items.split("\n").filter(Boolean).join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label={`Change ${m.name}`} onClick={() => setMenu({ ...m, items: m.items ?? "" })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${m.name}`} onClick={() => removeMenu(m)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="GST, invoice numbers and terms" description="Used for new functions; each function can still have its own GST." />
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="GST on food %" hint="Food and drinks served at a function.">
            <NumberInput value={defaults.foodGst} onChange={(n) => setDefaults({ ...defaults, foodGst: n })} />
          </Field>
          <Field label="GST on hall rent %">
            <NumberInput value={defaults.hallGst} onChange={(n) => setDefaults({ ...defaults, hallGst: n })} />
          </Field>
          <Field label="GST on services %" hint="Decoration, DJ, lighting and other services.">
            <NumberInput value={defaults.itemGst} onChange={(n) => setDefaults({ ...defaults, itemGst: n })} />
          </Field>
          <Field label="Invoice prefix" hint={`Banquet bills are numbered ${defaults.prefix || "BQ"}-1, ${defaults.prefix || "BQ"}-2…`}>
            <Input value={defaults.prefix} onChange={(e) => setDefaults({ ...defaults, prefix: e.target.value.toUpperCase() })} maxLength={10} />
          </Field>
          <Field
            label="Terms printed on quotations and confirmations"
            optional
            hint="For example: 50% advance to confirm, balance on the day; advance not refunded within 30 days; music till 10:30 pm."
            className="sm:col-span-2 lg:col-span-4"
          >
            <Textarea rows={4} value={defaults.terms ?? ""} onChange={(e) => setDefaults({ ...defaults, terms: e.target.value })} />
          </Field>
          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
            GST rates depend on your hotel (for example food at 5% or 18%, hall rent at 18%). Please confirm them with your accountant.
          </p>
          <Button loading={busy} onClick={() => save("/api/banquets/setup", { ...defaults, foodGst: defaults.foodGst ?? 0, hallGst: defaults.hallGst ?? 0, itemGst: defaults.itemGst ?? 0 }, "PUT", "Saved")}>
            Save
          </Button>
        </CardContent>
      </Card>

      <Modal
        open={!!hall}
        onClose={() => setHall(null)}
        title={hall?.id ? "Change hall" : "Add hall"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setHall(null)}>
              Close
            </Button>
            <Button
              loading={busy}
              disabled={!hall?.name.trim()}
              onClick={() => hall && save("/api/banquets/halls", { ...hall, capacity: hall.capacity ?? 0, rent: hall.rent ?? 0 }, hall.id ? "PATCH" : "POST", hall.id ? "Hall changed" : "Hall added")}
            >
              Save hall
            </Button>
          </>
        }
      >
        {hall && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input value={hall.name} onChange={(e) => setHall({ ...hall, name: e.target.value })} placeholder="e.g. Crystal Hall, Garden Lawn" autoFocus />
            </Field>
            <Field label="Guests it holds" optional>
              <NumberInput value={hall.capacity} onChange={(n) => setHall({ ...hall, capacity: n === null ? null : Math.round(n) })} />
            </Field>
            <Field label="Usual rent for one function" hint="Before GST. Can be changed on each function.">
              <NumberInput value={hall.rent} onChange={(n) => setHall({ ...hall, rent: n })} />
            </Field>
            <Field label="Notes" optional className="sm:col-span-2">
              <Input value={hall.notes} onChange={(e) => setHall({ ...hall, notes: e.target.value })} placeholder="AC, stage, parking for 50 cars…" />
            </Field>
            {hall.id && (
              <div className="sm:col-span-2">
                <Toggle checked={hall.active} onChange={(active) => setHall({ ...hall, active })} label="In use (switched off halls cannot be booked)" />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.id ? "Change menu" : "Add menu"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMenu(null)}>
              Close
            </Button>
            <Button
              loading={busy}
              disabled={!menu?.name.trim() || menu?.pricePerPlate === null}
              onClick={() => menu && save("/api/banquets/menus", { ...menu, pricePerPlate: menu.pricePerPlate ?? 0 }, menu.id ? "PATCH" : "POST", menu.id ? "Menu changed" : "Menu added")}
            >
              Save menu
            </Button>
          </>
        }
      >
        {menu && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input value={menu.name} onChange={(e) => setMenu({ ...menu, name: e.target.value })} placeholder="e.g. Gujarati thali, Gold buffet" autoFocus />
            </Field>
            <Field label="Veg / non-veg">
              <Select value={menu.foodType} onChange={(e) => setMenu({ ...menu, foodType: e.target.value })}>
                {FOOD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Price per plate" hint="Before GST.">
              <NumberInput value={menu.pricePerPlate} onChange={(n) => setMenu({ ...menu, pricePerPlate: n })} />
            </Field>
            <Field label="Dishes" optional hint="One per line: welcome drink, starters, main course, dessert…" className="sm:col-span-2">
              <Textarea rows={6} value={menu.items} onChange={(e) => setMenu({ ...menu, items: e.target.value })} />
            </Field>
            {menu.id && (
              <div className="sm:col-span-2">
                <Toggle checked={menu.active} onChange={(active) => setMenu({ ...menu, active })} label="In use" />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
