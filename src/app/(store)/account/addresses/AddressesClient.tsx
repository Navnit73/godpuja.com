"use client";

import { useState } from "react";
import AddressFields, { TextField, type Country } from "@/components/store/AddressFields";
import Modal from "@/components/ui/Modal";
import { addressLines, type Address } from "@/lib/address";
import { api, ApiClientError } from "@/lib/api";
import { MAX_ADDRESSES } from "@/lib/validation/account";
import type { SavedAddress } from "@/server/services/account";

type Draft = Address & { label: string; phone: string; isDefault: boolean };
const blank = (country: string): Draft => ({ name: "", line1: "", line2: "", city: "", state: "", postalCode: "", country, label: "", phone: "", isDefault: false });

export default function AddressesClient({ initial, countries, shipTo }: { initial: SavedAddress[]; countries: Country[]; shipTo: string[] }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function run(key: string, fn: () => Promise<SavedAddress[]>, done: string) {
    setBusy(key); setError(null); setErrs({});
    try { setList(await fn()); setStatus(done); return true; }
    catch (e) {
      if (e instanceof ApiClientError) { setError(e.fields ? "Please fix the highlighted fields." : e.message); setErrs(Object.fromEntries(Object.entries(e.fields ?? {}).map(([k, v]) => [`a.${k}`, v]))); }
      else setError("Something went wrong. Try again.");
      return false;
    } finally { setBusy(null); }
  }

  async function save() {
    if (!editing) return;
    const { draft, id } = editing;
    const body = { ...draft, line2: draft.line2 || undefined, label: draft.label || undefined };
    const ok = await run("save", () => (id ? api.patch<SavedAddress[]>(`/account/addresses/${id}`, body) : api.post<SavedAddress[]>("/account/addresses", body)), id ? "Address updated" : "Address added");
    if (ok) setEditing(null);
  }

  return (
    <div className="space-y-4">
      <p role="status" className="sr-only">{status}</p>
      {error && !editing && <p role="alert" className="alert-error">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{list.length} of {MAX_ADDRESSES} saved. You can choose them at checkout.</p>
        <button type="button" className="btn-primary btn-sm" disabled={list.length >= MAX_ADDRESSES}
          onClick={() => { setErrs({}); setError(null); setEditing({ id: null, draft: blank(shipTo[0] ?? "IN") }); }}>Add address</button>
      </div>
      {list.length === 0 ? (
        <div className="panel px-6 py-12 text-center text-sm text-muted">No saved addresses yet.</div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="panel space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{a.label || a.name}</p>
                {a.isDefault && <span className="badge-success">Default</span>}
              </div>
              <address className="text-sm not-italic text-muted">{addressLines(a).map((l, n) => <span key={n} className="block">{l}</span>)}{a.phone && <span className="block">{a.phone}</span>}</address>
              {!shipTo.includes(a.country) && <p className="text-xs text-muted">We do not deliver to this country yet; you can still use it for billing.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-outline btn-sm" onClick={() => { setErrs({}); setError(null); setEditing({ id: a.id, draft: { ...a, line2: a.line2 ?? "", label: a.label ?? "", phone: a.phone ?? "" } }); }}>Edit</button>
                {!a.isDefault && <button type="button" className="btn-ghost btn-sm" disabled={!!busy}
                  onClick={() => run(`def-${a.id}`, () => api.patch<SavedAddress[]>(`/account/addresses/${a.id}`, { ...a, line2: a.line2 || undefined, label: a.label || undefined, isDefault: true }), "Default address changed")}>Make default</button>}
                <button type="button" className="btn-ghost btn-sm text-danger" disabled={!!busy} aria-label={`Remove ${a.label || a.name}, ${a.line1}`}
                  onClick={() => run(`del-${a.id}`, () => api.delete<SavedAddress[]>(`/account/addresses/${a.id}`), "Address removed")}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit address" : "Add address"}>
        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4">
            {error && <p role="alert" className="alert-error">{error}</p>}
            <TextField id="a-label" label="Label (optional), e.g. Home" maxLength={40} value={editing.draft.label} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, label: v } })} error={errs["a.label"]} />
            <AddressFields prefix="a" a={editing.draft} set={(d) => setEditing({ ...editing, draft: { ...editing.draft, ...d } })} errs={errs} countries={countries} />
            <TextField id="a-phone" label="Phone (optional)" type="tel" autoComplete="tel" value={editing.draft.phone} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, phone: v } })} error={errs["a.phone"]} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.draft.isDefault} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, isDefault: e.target.checked } })} /> Use as my default address</label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save address"}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
