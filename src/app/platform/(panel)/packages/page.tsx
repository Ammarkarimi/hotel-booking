"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Loading, PageHeader, Tip } from "@/components/ui";
import { ModuleChecklist, money, type PackageRow } from "@/components/platform-ui";
import { api } from "@/lib/client";
import { ALWAYS_INCLUDED, type ModuleKey } from "@/lib/modules";

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<PackageRow[]>("/api/platform/packages").then(setPackages, (e) => setError(e.message));
  }, []);

  if (error && !packages) return <Tip tone="danger">{error}</Tip>;
  if (!packages) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Choose what each package includes. Every hotel on a package gets the change the next time someone there clicks anything."
      />
      <Tip>
        <b>Every package includes:</b> {ALWAYS_INCLUDED}
      </Tip>
      {packages.map((p) => (
        <PackageCard key={p.id} pkg={p} onSaved={setPackages} />
      ))}
      <NewPackageCard onSaved={setPackages} />
    </div>
  );
}

function PackageCard({ pkg, onSaved }: { pkg: PackageRow; onSaved: (list: PackageRow[]) => void }) {
  const initial = { name: pkg.name, description: pkg.description ?? "", monthlyFee: pkg.monthlyFee ? String(pkg.monthlyFee) : "", modules: pkg.modules };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);

  async function run(action: () => Promise<PackageRow[]>, done: string) {
    setSaving(true);
    setMessage(null);
    try {
      onSaved(await action());
      setMessage({ tone: "success", text: done });
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={pkg.name}
        description={
          `${pkg.hotels === 0 ? "No hotels" : pkg.hotels === 1 ? "1 hotel" : `${pkg.hotels} hotels`} on this package` +
          (pkg.monthlyFee > 0 ? `. Suggested fee ${money(pkg.monthlyFee)} a month.` : ".")
        }
      />
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Package name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Suggested monthly fee (₹)" optional hint="Filled in when you put a new hotel on this package.">
            <Input type="number" min={0} step="1" inputMode="numeric" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} />
          </Field>
          <Field label="Short description" optional className="sm:col-span-2">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Included in {form.name || "this package"}</p>
          <ModuleChecklist value={form.modules} onChange={(modules: ModuleKey[]) => setForm({ ...form, modules })} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
          <Button
            loading={saving}
            disabled={!changed || !form.name.trim()}
            onClick={() =>
              run(
                () => api<PackageRow[]>(`/api/platform/packages/${pkg.id}`, { method: "PATCH", body: { ...form, monthlyFee: Number(form.monthlyFee || 0) } }),
                pkg.hotels > 0 ? `Saved. ${pkg.hotels === 1 ? "1 hotel has" : `${pkg.hotels} hotels have`} the new set now.` : "Saved"
              )
            }
          >
            Save package
          </Button>
          <Button
            variant="outline"
            className="text-red-700"
            disabled={saving}
            onClick={() => {
              if (window.confirm(`Delete the ${pkg.name} package?`)) run(() => api<PackageRow[]>(`/api/platform/packages/${pkg.id}`, { method: "DELETE" }), "Deleted");
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          {message && <span className={message.tone === "success" ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>{message.text}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function NewPackageCard({ onSaved }: { onSaved: (list: PackageRow[]) => void }) {
  const empty = { name: "", description: "", monthlyFee: "", modules: [] as ModuleKey[] };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add a package
      </Button>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      onSaved(await api<PackageRow[]>("/api/platform/packages", { body: { ...form, monthlyFee: Number(form.monthlyFee || 0) } }));
      setForm(empty);
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="New package" />
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Package name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            </Field>
            <Field label="Suggested monthly fee (₹)" optional>
              <Input type="number" min={0} step="1" inputMode="numeric" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} />
            </Field>
            <Field label="Short description" optional className="sm:col-span-2">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <ModuleChecklist value={form.modules} onChange={(modules) => setForm({ ...form, modules })} />
          {error && <Tip tone="danger">{error}</Tip>}
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>Add package</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
