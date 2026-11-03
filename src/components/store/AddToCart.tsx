"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cart, MAX_QTY } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { CartIcon } from "./Icons";

type Variant = { sku: string; options: Record<string, string>; price: number; salePrice: number | null; inStock: boolean };
type Props = { productId: string; price: number; salePrice: number | null; inStock: boolean; upcoming?: boolean; variants: Variant[] };

const label = (v: Variant) => Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(", ");

/** Mobile sticky bar: visible while the main buy row is off screen. While the bar exists the page gets bottom padding
 *  (`has-buy-bar`, mobile only) so the bar never covers the end of the footer. */
function useStickyBar(target: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") return;
    document.body.classList.add("has-buy-bar");
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting));
    io.observe(el);
    return () => { io.disconnect(); document.body.classList.remove("has-buy-bar"); };
  }, [target, enabled]);
  return enabled && show;
}

export default function AddToCart({ productId, price, salePrice, inStock, upcoming = false, variants }: Props) {
  const firstAvailable = variants.find((v) => v.inStock) ?? variants[0];
  const [sku, setSku] = useState<string>(firstAvailable?.sku ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const buyRow = useRef<HTMLDivElement>(null);
  const v = variants.find((x) => x.sku === sku);
  const unit = v ? v.salePrice ?? v.price : salePrice ?? price;
  const was = v ? (v.salePrice != null ? v.price : null) : salePrice != null ? price : null;
  const available = v ? v.inStock : inStock;
  const canBuy = available && !upcoming;
  const bar = useStickyBar(buyRow, canBuy);
  const add = () => { cart.add(productId, v ? v.sku : null, qty); setAdded(true); };

  return (
    <div className="space-y-4">
      <div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-3xl font-semibold text-primary">{formatMoney(unit)}</span>
          {was != null && <s className="text-base text-muted"><span className="sr-only">Was </span>{formatMoney(was)}</s>}
          {was != null && was > 0 && <span className="badge bg-kumkum-700 text-white">{Math.round((1 - unit / was) * 100)}% off</span>}
        </p>
        <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>
      </div>

      {variants.length > 0 && (
        <div>
          <label htmlFor="variant" className="label">Choose an option</label>
          <select id="variant" className="input max-w-sm" value={sku} onChange={(e) => { setSku(e.target.value); setAdded(false); }}>
            {variants.map((x) => <option key={x.sku} value={x.sku} disabled={!x.inStock}>{label(x)}{x.inStock ? "" : " — out of stock"}</option>)}
          </select>
        </div>
      )}

      {upcoming ? (
        <p className="font-medium text-primary">Coming soon — this item will be available to order shortly.</p>
      ) : available ? (
        <div ref={buyRow} className="flex items-stretch gap-3">
          <div role="group" aria-label="Quantity" className="inline-flex h-12 shrink-0 items-center rounded-full border border-input-border bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
            <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} className="h-12 w-11 rounded-l-full text-xl text-foreground hover:bg-sandal-100 focus-visible:bg-sandal-100 disabled:opacity-40" onClick={() => { setQty((q) => Math.max(1, q - 1)); setAdded(false); }}>−</button>
            <input id="qty" aria-label="Quantity" inputMode="numeric" type="number" min={1} max={MAX_QTY} value={qty} className="h-12 w-10 border-0 bg-transparent text-center text-base font-medium text-foreground outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" onChange={(e) => { setQty(Math.min(MAX_QTY, Math.max(1, Math.trunc(Number(e.target.value) || 1)))); setAdded(false); }} />
            <button type="button" aria-label="Increase quantity" disabled={qty >= MAX_QTY} className="h-12 w-11 rounded-r-full text-xl text-foreground hover:bg-sandal-100 focus-visible:bg-sandal-100 disabled:opacity-40" onClick={() => { setQty((q) => Math.min(MAX_QTY, q + 1)); setAdded(false); }}>+</button>
          </div>
          <button type="button" className="btn-primary h-12 min-w-0 flex-1 gap-2 px-4 text-base sm:px-8" onClick={add}><CartIcon className="h-5 w-5 shrink-0" />Add to cart</button>
        </div>
      ) : (
        <p className="font-medium text-danger">Out of stock</p>
      )}
      <p role="status" aria-live="polite" className={added ? "rounded-lg bg-success/10 px-3 py-2 text-sm text-success" : "sr-only"}>
        {added && <>Added to your cart. <Link href="/cart" className="font-medium underline">View cart</Link></>}
      </p>

      {/* Mobile sticky buy bar: slides in once the main buy row scrolls away; inert (out of tab order) while hidden. */}
      {canBuy && (
        <div inert={!bar} aria-hidden={!bar}
          className={`pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-sandal-200 bg-surface px-4 pt-3 shadow-elev-4 transition-transform duration-200 ease-standard md:hidden ${bar ? "translate-y-0" : "translate-y-full"}`}>
          <div className="flex items-center gap-3">
            <p className="flex min-w-0 flex-col leading-tight">
              <span className="text-lg font-semibold text-primary">{formatMoney(unit)}</span>
              {was != null && <s className="text-xs text-muted"><span className="sr-only">Was </span>{formatMoney(was)}</s>}
            </p>
            {added
              ? <Link href="/cart" className="btn-outline h-11 flex-1 gap-2"><CartIcon className="h-5 w-5" />View cart</Link>
              : <button type="button" className="btn-primary h-11 flex-1 gap-2" onClick={add}><CartIcon className="h-5 w-5" />Add {qty > 1 ? `${qty} ` : ""}to cart</button>}
          </div>
        </div>
      )}
    </div>
  );
}
