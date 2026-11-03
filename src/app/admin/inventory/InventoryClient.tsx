"use client";

import { useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import type { InventoryItem } from "@/server/services/products";

type Row = { key: string; id: string; sku?: string; label: string; stock: number; threshold: number; low: boolean };

function toRows(items: InventoryItem[]): Row[] {
  return items.flatMap((p) =>
    p.variants.length
      ? p.variants.map((v) => ({ key: `${p.id}:${v.sku}`, id: p.id, sku: v.sku, label: `${p.name} — ${Object.values(v.options).join(" / ")}`, stock: v.stock, threshold: p.lowStockThreshold, low: v.stock <= p.lowStockThreshold }))
      : [{ key: p.id, id: p.id, label: p.name, stock: p.stock, threshold: p.lowStockThreshold, low: p.lowStock }],
  );
}

export default function InventoryClient({ items }: { items: InventoryItem[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(() => toRows(items));
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  async function apply(r: Row, body: { delta: number } | { set: number }) {
    setBusy(r.key);
    try {
      const res = await api.patch<{ stock: number; variants: { sku: string; stock: number }[] }>(`/admin/inventory/${r.id}`, { ...(r.sku ? { sku: r.sku } : {}), ...body });
      const next = r.sku ? res.variants.find((v) => v.sku === r.sku)?.stock ?? r.stock : res.stock;
      setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, stock: next, low: next <= x.threshold } : x)));
      setAmount((a) => ({ ...a, [r.key]: "" }));
      setAnnounce(`${r.label}: stock is now ${next}`);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.fields?.sku ?? e.message : "Could not update stock", "error");
    } finally { setBusy(null); }
  }

  if (rows.length === 0) return <div className="card hover:shadow-elev-1"><EmptyState title="No products found" description="Add products first, then manage their stock here." /></div>;
  return (
    <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <table className="data-table">
        <caption className="sr-only">Stock levels</caption>
        <thead><tr><th scope="col">Product</th><th scope="col">In stock</th><th scope="col">Change</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const n = Number(amount[r.key]);
            const valid = Number.isInteger(n) && (amount[r.key] ?? "") !== "";
            return (
              <tr key={r.key}>
                <td className="font-medium">{r.label}{r.sku && <span className="ml-2 text-xs text-muted">{r.sku}</span>}</td>
                <td>{r.stock}{r.low && <span className="badge-danger ml-2">Low</span>}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`amt-${r.key}`}>Quantity for {r.label}</label>
                    <input id={`amt-${r.key}`} type="number" min={0} step={1} className="input h-9 w-24" value={amount[r.key] ?? ""} onChange={(e) => setAmount((a) => ({ ...a, [r.key]: e.target.value }))} />
                    <button type="button" className="btn-outline btn-sm" disabled={!valid || n <= 0 || busy === r.key} onClick={() => apply(r, { delta: n })}>Add</button>
                    <button type="button" className="btn-outline btn-sm" disabled={!valid || n <= 0 || busy === r.key} onClick={() => apply(r, { delta: -n })}>Remove</button>
                    <button type="button" className="btn-outline btn-sm" disabled={!valid || n < 0 || busy === r.key} onClick={() => apply(r, { set: n })}>Set to</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
