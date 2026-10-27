"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Download, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Textarea } from "@/components/ui";
import { BarList } from "@/components/bar-list";
import { MethodPicker } from "@/components/booking-actions";
import { PeriodPicker, periodFor, type PeriodValue } from "@/components/period-picker";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { groupLabel } from "@/lib/periods";
import { cn, EXPENSE_CATEGORIES, formatCurrency, label } from "@/lib/utils";

interface ExpenseRow {
  id: string;
  date: string;
  category: string;
  title: string;
  description: string | null;
  amount: number;
  method: string;
  addedBy: string | null;
  canEdit: boolean;
}

const EMPTY = { date: "", category: "", title: "", description: "", amount: "", method: "cash" };

function ExpenseDialog({ open, editing, onClose, onSaved }: { open: boolean; editing: ExpenseRow | null; onClose: () => void; onSaved: () => void }) {
  const { settings, isAdmin, toast, confirm } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? { date: editing.date, category: editing.category, title: editing.title, description: editing.description ?? "", amount: String(editing.amount), method: editing.method }
        : { ...EMPTY, date: settings.today }
    );
  }, [open, editing, settings.today]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) return toast("Please choose what kind of cost this is", "error");
    setSaving(true);
    try {
      const body = { ...form, amount: Number(form.amount) };
      if (editing) await api(`/api/expenses/${editing.id}`, { method: "PATCH", body });
      else await api("/api/expenses", { body });
      toast(editing ? "Expense updated" : `${formatCurrency(Number(form.amount))} written down`);
      onSaved();
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    const ok = await confirm({ title: "Delete this expense?", message: `${editing.title} — ${formatCurrency(editing.amount)}`, confirmText: "Yes, delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/expenses/${editing.id}`, { method: "DELETE" });
      toast("Expense deleted");
      onSaved();
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Change expense" : "Add an expense"} description="Any money the hotel spends: bills, salaries, supplies, repairs." size="lg">
      <form onSubmit={save} className="space-y-4">
        <Field label="Amount">
          <Input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            autoFocus={!editing}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="text-lg font-semibold"
            placeholder="0"
          />
        </Field>
        <Field label="What was it for?" hint="e.g. Electricity bill for October, 20 bedsheets, plumber for Room 204">
          <Input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Kind of cost</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, category: c })}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-sm font-semibold",
                  form.category === c ? "border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                {label(c)}
              </button>
            ))}
          </div>
        </div>
        <Field label="Date" hint={isAdmin ? undefined : "Front desk can add costs from the last 7 days."}>
          <Input type="date" required value={form.date} max={settings.today} min={isAdmin ? undefined : addDays(settings.today, -7)} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Paid by">
          <MethodPicker value={form.method} onChange={(method) => setForm({ ...form, method })} />
        </Field>
        <Field label="Notes" optional hint="Bill number, shop name, who was paid...">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </Field>
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          {editing ? (
            <Button variant="ghost" className="text-red-600" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Save expense"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function ExpensesPage() {
  const { settings, isAdmin } = useApp();
  const [period, setPeriod] = useState<PeriodValue>(() => periodFor("month", settings.today));
  const [category, setCategory] = useState("all");
  const [rows, setRows] = useState<ExpenseRow[] | null>(null);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const load = useCallback(() => {
    if (period.to < period.from) return;
    setError("");
    api<ExpenseRow[]>(`/api/expenses?from=${period.from}&to=${period.to}${category !== "all" ? `&category=${category}` : ""}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [period.from, period.to, category]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const total = (rows ?? []).reduce((s, e) => s + e.amount, 0);
  const cash = (rows ?? []).filter((e) => e.method === "cash").reduce((s, e) => s + e.amount, 0);
  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of rows ?? []) m[e.category] = (m[e.category] || 0) + e.amount;
    return m;
  }, [rows]);
  const byDay = useMemo(() => {
    const m = new Map<string, ExpenseRow[]>();
    for (const e of rows ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [rows]);
  const biggest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={
          isAdmin
            ? "Write down every cost: salaries, electricity, supplies, repairs. Reports take them away from your earnings to show your profit."
            : "Write down money you spend for the hotel, like supplies or small repairs. The owner sees it in the reports."
        }
        actions={
          <Button size="lg" onClick={openNew}>
            <Plus className="h-5 w-5" /> Add expense
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PeriodPicker value={period} onChange={setPeriod} today={settings.today} />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="lg:w-64" aria-label="Kind of cost">
          <option value="all">All kinds of cost</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows ? (
        !error && <Loading text="Loading expenses..." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard title="Total spent" value={formatCurrency(total)} subtitle={`${rows.length} expense${rows.length === 1 ? "" : "s"}`} icon={<Receipt className="h-5 w-5" />} tone="amber" />
            <StatCard title="Paid in cash" value={formatCurrency(cash)} subtitle="Taken from the cash drawer" icon={<Banknote className="h-5 w-5" />} tone="slate" />
            <StatCard
              title="Biggest cost"
              value={biggest ? label(biggest[0]) : "—"}
              subtitle={biggest ? `${formatCurrency(biggest[1])} · ${total ? Math.round((biggest[1] / total) * 100) : 0}% of all costs` : "Nothing yet"}
              icon={<Wallet className="h-5 w-5" />}
              tone="slate"
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="No expenses in this period"
              description="Add bills, salaries and shopping as you pay them, so your reports show the real profit."
              action={<Button onClick={openNew}>Add expense</Button>}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader title="All expenses" description={rows.some((r) => r.canEdit) ? "Tap an expense to change or delete it." : undefined} />
                <div className="divide-y divide-slate-100">
                  {byDay.map(([day, list]) => (
                    <div key={day}>
                      <div className="flex justify-between bg-slate-50 px-5 py-2 text-xs font-bold uppercase text-slate-500">
                        <span>{groupLabel(day, "day")}</span>
                        <span>{formatCurrency(list.reduce((s, e) => s + e.amount, 0))}</span>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {list.map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              disabled={!e.canEdit}
                              onClick={() => {
                                setEditing(e);
                                setDialogOpen(true);
                              }}
                              className="flex w-full items-start justify-between gap-3 px-5 py-3 text-left enabled:hover:bg-slate-50"
                            >
                              <span className="min-w-0">
                                <span className="block font-semibold text-slate-900">{e.title}</span>
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                  <Badge>{label(e.category)}</Badge>
                                  {label(e.method)}
                                  {e.addedBy && <span>· by {e.addedBy}</span>}
                                </span>
                                {e.description && <span className="mt-1 block text-sm text-slate-600">{e.description}</span>}
                              </span>
                              <span className="shrink-0 font-bold text-slate-900">{formatCurrency(e.amount)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="space-y-6">
                <Card>
                  <CardHeader title="By kind of cost" />
                  <CardContent>
                    <BarList tone="amber" data={Object.entries(byCategory).map(([key, value]) => ({ key, value }))} />
                  </CardContent>
                </Card>
                {isAdmin && (
                  <Card>
                    <CardContent className="space-y-2 py-4">
                      <Link href="/reports" className="block font-semibold text-primary-700 hover:underline">
                        See your profit in Reports →
                      </Link>
                      <a href={`/api/reports/export?type=expenses&from=${period.from}&to=${period.to}`} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
                        <Download className="h-4 w-4" /> Download for Excel
                      </a>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <ExpenseDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} onSaved={load} />
    </div>
  );
}
