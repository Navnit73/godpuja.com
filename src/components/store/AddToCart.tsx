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
        <div className="space-y-2">
          <span id="qty-label" className="label">Quantity</span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div role="group" aria-labelledby="qty-label" className="inline-flex h-12 w-fit items-center rounded-full border border-sandal-200 bg-white">
              <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} className="h-12 w-12 rounded-l-full text-xl hover:bg-sandal-100 disabled:opacity-40" onClick={() => { setQty((q) => Math.max(1, q - 1)); setAdded(false); }}>−</button>
              <input id="qty" aria-label="Quantity" inputMode="numeric" type="number" min={1} max={MAX_QTY} value={qty} className="h-12 w-12 border-0 bg-transparent text-center text-base font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" onChange={(e) => { setQty(Math.min(MAX_QTY, Math.max(1, Math.trunc(Number(e.target.value) || 1)))); setAdded(false); }} />
              <button type="button" aria-label="Increase quantity" disabled={qty >= MAX_QTY} className="h-12 w-12 rounded-r-full text-xl hover:bg-sandal-100 disabled:opacity-40" onClick={() => { setQty((q) => Math.min(MAX_QTY, q + 1)); setAdded(false); }}>+</button>
            </div>
            <button type="button" className="btn-primary h-12 flex-1 gap-2 px-8 text-base" onClick={() => { cart.add(productId, v ? v.sku : null, qty); setAdded(true); }}><CartIcon className="h-5 w-5" />Add to cart</button>
          </div>
        </div>
      ) : (
        <p className="font-medium text-danger">Out of stock</p>
      )}
      <p role="status" aria-live="polite" className={added ? "rounded-lg bg-success/10 px-3 py-2 text-sm text-success" : "sr-only"}>
        {added && <>Added to your cart. <Link href="/cart" className="font-medium underline">View cart</Link></>}
      </p>
    </div>
  );
}
