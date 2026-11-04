"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { formatDateTime, isoToIstInput, istInputToIso } from "@/lib/format";
import { formatMoney, paiseToRupees, rupeesToPaise } from "@/lib/money";
import type { CouponType } from "@/lib/pricing";
import type { AdminCoupon } from "@/server/services/coupons";

const TYPE_LABEL: Record<CouponType, string> = { percent: "Percentage off", fixed: "Fixed amount off", free_shipping: "Free shipping" };
const terms = (c: AdminCoupon) => c.type === "percent" ? `${c.value}% off${c.maxDiscount ? `, up to ${formatMoney(c.maxDiscount)}` : ""}` : c.type === "fixed" ? `${formatMoney(c.value)} off` : "Free shipping";

type Form = { code: string; description: string; type: CouponType; value: string; maxDiscount: string; minSubtotal: string; startsAt: string; expiresAt: string; usageLimit: string; perCustomerLimit: string; isActive: boolean };
const blank: Form = { code: "", description: "", type: "percent", value: "10", maxDiscount: "", minSubtotal: "", startsAt: "", expiresAt: "", usageLimit: "", perCustomerLimit: "1", isActive: true };
const toForm = (c: AdminCoupon): Form => ({
  code: c.code, description: c.description, type: c.type, value: c.type === "fixed" ? paiseToRupees(c.value) : String(c.value), maxDiscount: paiseToRupees(c.maxDiscount), minSubtotal: paiseToRupees(c.minSubtotal),
  startsAt: c.startsAt ? isoToIstInput(c.startsAt) : "", expiresAt: c.expiresAt ? isoToIstInput(c.expiresAt) : "", usageLimit: c.usageLimit ? String(c.usageLimit) : "", perCustomerLimit: c.perCustomerLimit ? String(c.perCustomerLimit) : "", isActive: c.isActive,
});

/** Form -> API body. Money fields are typed in rupees; `null` where a field is blank. A bad number is sent as NaN-free text the server rejects with a field error. */
function toBody(f: Form) {
  const money = (v: string) => { const p = rupeesToPaise(v); return p === null ? null : Number.isNaN(p) ? -1 : p; };
  const int = (v: string) => (v.trim() === "" ? null : /^\d+$/.test(v.trim()) ? Number(v) : -1);
  return {
    code: f.code, description: f.description, type: f.type,
    value: f.type === "free_shipping" ? 0 : f.type === "percent" ? (int(f.value) ?? 0) : (money(f.value) ?? 0),
    maxDiscount: f.type === "percent" ? money(f.maxDiscount) : null, minSubtotal: money(f.minSubtotal) ?? 0,
    startsAt: f.startsAt ? istInputToIso(f.startsAt) : null, expiresAt: f.expiresAt ? istInputToIso(f.expiresAt) : null,
    usageLimit: int(f.usageLimit), perCustomerLimit: int(f.perCustomerLimit), isActive: f.isActive,
  };
}

export default function CouponsClient({ initial }: { initial: AdminCoupon[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; base: string; form: Form } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<AdminCoupon | null>(null);
  const set = (k: keyof Form, v: string | boolean) => editing && setEditing({ ...editing, form: { ...editing.form, [k]: v } });

  async function save() {
    if (!editing) return;
    setBusy(true); setError(null); setErrs({});
    try {
      const body = toBody(editing.form);
      if (editing.id) await api.patch(`/admin/coupons/${editing.id}`, { ...body, baseUpdatedAt: editing.base }); else await api.post("/admin/coupons", body);
      toast(editing.id ? "Coupon saved" : "Coupon created"); setEditing(null); router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) { setErrs(e.fields ?? {}); setError(e.fields ? "Please fix the highlighted fields." : e.message); } else setError("Something went wrong. Try again.");
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    try { await api.delete(`/admin/coupons/${removing.id}`); toast("Coupon deleted"); setRemoving(null); router.refresh(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not delete."); } finally { setBusy(false); }
  }

  const f = editing?.form;
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => { setErrs({}); setError(null); setEditing({ id: null, base: "", form: blank }); }}>Add coupon</Button></div>
      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {initial.length === 0 ? <EmptyState title="No coupons yet" description="Create a code to offer customers a discount." /> : (
          <table className="data-table">
            <caption className="sr-only">Coupons</caption>
            <thead><tr><th scope="col">Code</th><th scope="col">Offer</th><th scope="col">Used</th><th scope="col">Valid</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {initial.map((c) => {
                return (
                  <tr key={c.id}>
                    <td><span className="font-mono font-medium">{c.code}</span>{c.description && <span className="block text-xs text-muted">{c.description}</span>}</td>
                    <td>{terms(c)}{c.minSubtotal > 0 && <span className="block text-xs text-muted">Min. order {formatMoney(c.minSubtotal)}</span>}</td>
                    <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                    <td className="text-xs text-muted">{c.startsAt ? `From ${formatDateTime(c.startsAt)}` : "Any time"}{c.expiresAt && <span className="block">Until {formatDateTime(c.expiresAt)}</span>}</td>
                    <td><span className={c.state === "live" ? "badge-success" : "badge-muted"}>{{ live: "Live", scheduled: "Scheduled", expired: "Expired", off: "Off" }[c.state]}</span></td>
                    <td className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setErrs({}); setError(null); setEditing({ id: c.id, base: c.updatedAt, form: toForm(c) }); }} aria-label={`Edit ${c.code}`}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setError(null); setRemoving(c); }} aria-label={`Delete ${c.code}`}>Delete</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit coupon" : "Add coupon"}>
        {editing && f && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4">
            {error && <p role="alert" className="alert-error">{error}</p>}
            <Input label="Code" value={f.code} disabled={!!editing.id} maxLength={30} error={errs.code} hint="Customers type this. Letters, numbers, dashes. It cannot be changed later." onChange={(e) => set("code", e.target.value.toUpperCase())} />
            <Input label="Note (only you see this)" value={f.description} maxLength={200} onChange={(e) => set("description", e.target.value)} />
            <Select label="Offer" value={f.type} onChange={(e) => set("type", e.target.value)}>{(Object.keys(TYPE_LABEL) as CouponType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select>
            {f.type !== "free_shipping" && <Input label={f.type === "percent" ? "Percent off (1–100)" : "Amount off (₹)"} inputMode="decimal" value={f.value} error={errs.value} onChange={(e) => set("value", e.target.value)} />}
            {f.type === "percent" && <Input label="Largest discount (₹, optional)" inputMode="decimal" value={f.maxDiscount} error={errs.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} />}
            <Input label="Minimum order (₹, optional)" inputMode="decimal" value={f.minSubtotal} error={errs.minSubtotal} hint="Checked against the items total before shipping." onChange={(e) => set("minSubtotal", e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Starts (IST, optional)" type="datetime-local" value={f.startsAt} error={errs.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              <Input label="Ends (IST, optional)" type="datetime-local" value={f.expiresAt} error={errs.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
              <Input label="Total uses (optional)" inputMode="numeric" value={f.usageLimit} error={errs.usageLimit} hint="Blank = unlimited." onChange={(e) => set("usageLimit", e.target.value)} />
              <Input label="Uses per customer email" inputMode="numeric" value={f.perCustomerLimit} error={errs.perCustomerLimit} hint="Blank = unlimited." onChange={(e) => set("perCustomerLimit", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-saffron-600" /> Active</label>
            <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}>{editing.id ? "Save changes" : "Create coupon"}</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Delete ${removing?.code ?? "coupon"}?`}>
        <p className="text-sm text-muted">Customers can no longer use this code. Past orders keep their discount. To pause it instead, switch it off.</p>
        {error && <p role="alert" className="alert-error mt-3">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setRemoving(null)}>Keep</Button><Button variant="danger" onClick={remove} loading={busy}>Delete coupon</Button></div>
      </Modal>
    </>
  );
}
