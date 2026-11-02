"use client";

import Link from "next/link";
import { useState } from "react";
import { cart, MAX_QTY } from "@/lib/cart";
import { formatPaise } from "@/lib/money";
import { CartIcon } from "./Icons";

type Variant = { sku: string; options: Record<string, string>; price: number; salePrice: number | null; inStock: boolean };
type Props = { productId: string; price: number; salePrice: number | null; inStock: boolean; variants: Variant[] };

const label = (v: Variant) => Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(", ");

export default function AddToCart({ productId, price, salePrice, inStock, variants }: Props) {
  const firstAvailable = variants.find((v) => v.inStock) ?? variants[0];
  const [sku, setSku] = useState<string>(firstAvailable?.sku ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const v = variants.find((x) => x.sku === sku);
  const unit = v ? v.salePrice ?? v.price : salePrice ?? price;
  const was = v ? (v.salePrice != null ? v.price : null) : salePrice != null ? price : null;
  const available = v ? v.inStock : inStock;

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-baseline gap-3 text-3xl font-semibold">
        <span className="text-primary">{formatPaise(unit)}</span>
        {was != null && <s className="text-lg font-normal text-muted"><span className="sr-only">Was </span>{formatPaise(was)}</s>}
        {was != null && was > 0 && <span className="badge bg-kumkum-700 text-white">{Math.round((1 - unit / was) * 100)}% off</span>}
      </p>
      <p className="text-xs text-muted">Inclusive of all taxes</p>

      {variants.length > 0 && (
        <div>
          <label htmlFor="variant" className="label">Choose an option</label>
          <select id="variant" className="input max-w-sm" value={sku} onChange={(e) => { setSku(e.target.value); setAdded(false); }}>
            {variants.map((x) => <option key={x.sku} value={x.sku} disabled={!x.inStock}>{label(x)}{x.inStock ? "" : " — out of stock"}</option>)}
          </select>
        </div>
      )}

      {available ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="qty" className="label">Quantity</label>
            <input id="qty" type="number" min={1} max={MAX_QTY} value={qty} className="input w-24" onChange={(e) => { setQty(Math.min(MAX_QTY, Math.max(1, Math.trunc(Number(e.target.value) || 1)))); setAdded(false); }} />
          </div>
          <button type="button" className="btn-primary h-10 gap-2 px-8" onClick={() => { cart.add(productId, v ? v.sku : null, qty); setAdded(true); }}><CartIcon className="h-4 w-4" />Add to cart</button>
        </div>
      ) : (
        <p className="font-medium text-danger">Out of stock</p>
      )}
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-success">
        {added && <>Added to your cart. <Link href="/cart" className="font-medium underline">View cart</Link></>}
      </p>
    </div>
  );
}
