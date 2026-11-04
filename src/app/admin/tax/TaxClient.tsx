"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { countryName } from "@/lib/address";
import { api, ApiClientError } from "@/lib/api";
import { rateLabel } from "@/lib/pricing";
import type { AdminTaxRule } from "@/server/services/tax";

type Form = { country: string; name: string; rate: string; inclusive: boolean; appliesToShipping: boolean; isActive: boolean };
const blank = (c: string): Form => ({ country: c, name: "", rate: "", inclusive: true, appliesToShipping: false, isActive: true });
/** "18" / "5.5" / "5.25" -> basis points (1800 / 550 / 525). null if it is not a plain percentage. */
const toBps = (v: string) => (/^\d{1,3}(\.\d{1,2})?$/.test(v.trim()) ? Math.round(parseFloat(v) * 100) : null);

export default function TaxClient({ initial, countries }: { initial: AdminTaxRule[]; countries: { code: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; base: string; form: Form } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<AdminTaxRule | null>(null);
  const set = (k: keyof Form, v: string | boolean) => editing && setEditing({ ...editing, form: { ...editing.form, [k]: v } });

  async function save() {
    if (!editing) return;
    const { form } = editing;
    const bps = toBps(form.rate);
    setErrs({}); setError(null);
    if (bps === null) { setErrs({ rate: "Enter a percentage like 18 or 5.5" }); return; }
    setBusy(true);
    try {
      const body = { country: form.country, name: form.name, rateBps: bps, inclusive: form.inclusive, appliesToShipping: form.appliesToShipping, isActive: form.isActive };
      if (editing.id) await api.patch(`/admin/tax-rules/${editing.id}`, { ...body, baseUpdatedAt: editing.base }); else await api.post("/admin/tax-rules", body);
      toast("Tax rule saved"); setEditing(null); router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) { setErrs({ ...(e.fields ?? {}), ...(e.fields?.rateBps ? { rate: e.fields.rateBps } : {}) }); setError(e.fields ? "Please fix the highlighted fields." : e.message); } else setError("Something went wrong. Try again.");
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    try { await api.delete(`/admin/tax-rules/${removing.id}`); toast("Tax rule deleted"); setRemoving(null); router.refresh(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not delete."); } finally { setBusy(false); }
  }

  const f = editing?.form;
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => { setErrs({}); setError(null); setEditing({ id: null, base: "", form: blank("IN") }); }}>Add tax rule</Button></div>
      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {initial.length === 0 ? <EmptyState title="No tax rules" description="Orders currently show no tax line. Add a rule for each country you deliver to." /> : (
          <table className="data-table">
            <caption className="sr-only">Tax rules</caption>
            <thead><tr><th scope="col">Country</th><th scope="col">Tax</th><th scope="col">Prices</th><th scope="col">Shipping</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {initial.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{countryName(r.country) ?? r.country}</td>
                  <td>{r.name} {rateLabel(r.rateBps)}</td>
                  <td>{r.inclusive ? "Include tax" : "Tax added at checkout"}</td>
                  <td>{r.appliesToShipping ? "Taxed" : "Not taxed"}</td>
                  <td><span className={r.isActive ? "badge-success" : "badge-muted"}>{r.isActive ? "On" : "Off"}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="sm" aria-label={`Edit ${countryName(r.country) ?? r.country}`} onClick={() => { setErrs({}); setError(null); setEditing({ id: r.id, base: r.updatedAt, form: { country: r.country, name: r.name, rate: String(r.rateBps / 100), inclusive: r.inclusive, appliesToShipping: r.appliesToShipping, isActive: r.isActive } }); }}>Edit</Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${countryName(r.country) ?? r.country}`} onClick={() => { setError(null); setRemoving(r); }}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit tax rule" : "Add tax rule"}>
        {editing && f && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4">
            {error && <p role="alert" className="alert-error">{error}</p>}
            <Select label="Destination country" value={f.country} disabled={!!editing.id} error={errs.country} onChange={(e) => set("country", e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>
            <Input label="Tax name" value={f.name} maxLength={30} error={errs.name} hint="Shown to customers, e.g. GST or VAT." onChange={(e) => set("name", e.target.value)} />
            <Input label="Rate (%)" inputMode="decimal" value={f.rate} error={errs.rate} onChange={(e) => set("rate", e.target.value)} />
            <fieldset className="space-y-2"><legend className="label">Catalogue prices</legend>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="inclusive" checked={f.inclusive} onChange={() => set("inclusive", true)} className="mt-1" /> <span>Already include this tax (shown on the order, total unchanged)</span></label>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="inclusive" checked={!f.inclusive} onChange={() => set("inclusive", false)} className="mt-1" /> <span>Do not include it (added to the total at checkout)</span></label>
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.appliesToShipping} onChange={(e) => set("appliesToShipping", e.target.checked)} className="h-4 w-4 accent-saffron-600" /> Also tax the shipping charge</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-saffron-600" /> Rule is on</label>
            <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}>{editing.id ? "Save changes" : "Add rule"}</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Delete this tax rule?">
        <p className="text-sm text-muted">New orders to {removing ? countryName(removing.country) ?? removing.country : "this country"} will show no tax. Past orders keep their figures.</p>
        {error && <p role="alert" className="alert-error mt-3">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setRemoving(null)}>Keep</Button><Button variant="danger" onClick={remove} loading={busy}>Delete rule</Button></div>
      </Modal>
    </>
  );
}
