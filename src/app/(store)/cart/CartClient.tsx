"use client";
/* eslint-disable @next/next/no-img-element -- remote product images */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { cart, MAX_QTY, useCart } from "@/lib/cart";
import { formatPaise } from "@/lib/money";
import type { CartValidation } from "@/lib/storefront-api";

/** Server-validated cart: prices and stock always come from the API, never from the browser. */
export function useValidatedCart() {
  const lines = useCart();
  const key = JSON.stringify(lines);
  const [state, setState] = useState<{ key: string; data: CartValidation | null; error: string | null }>({ key: "", data: null, error: null });
  useEffect(() => {
    if (lines.length === 0) return;
    let live = true;
    api.post<CartValidation>("/cart/validate", { items: lines })
      .then((data) => live && setState({ key, data, error: null }))
      .catch((e) => live && setState({ key, data: null, error: e instanceof ApiClientError ? e.message : "Could not load your cart. Try again." }));
    return () => { live = false; };
  }, [key, lines]);
  const loading = lines.length > 0 && state.key !== key;
  return { lines, loading, data: lines.length ? (state.key === key ? state.data : null) : null, error: state.key === key ? state.error : null };
}

export default function CartClient() {
  const { lines, loading, data, error } = useValidatedCart();
  const [announce, setAnnounce] = useState("");
  const clamped = useRef(false);

  // If the server could only offer fewer units than the cart holds, bring the stored quantities in line once.
  useEffect(() => {
    if (!data || clamped.current) return;
    clamped.current = true;
    for (const i of data.items) if (i.available && i.qty < (lines.find((l) => l.productId === i.productId && l.variantSku === i.variantSku)?.qty ?? 0)) cart.setQty(i.productId, i.variantSku, i.qty);
  }, [data, lines]);

  if (lines.length === 0) {
    return (
      <div className="card px-6 py-16 text-center hover:shadow-elev-1">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted">Find something for your next puja.</p>
        <Link href="/" className="btn-primary mt-5">Continue shopping</Link>
      </div>
    );
  }
  if (error) return <p role="alert" className="alert-error">{error}</p>;
  if (loading || !data) return <p role="status" className="text-muted">Loading your cart…</p>;

  const buyable = data.items.filter((i) => i.available);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <div className="space-y-4">
        {data.issues.length > 0 && (
          <ul role="status" className="alert-error space-y-1">{data.issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>
        )}
        <ul className="space-y-3">
          {data.items.map((i) => (
            <li key={`${i.productId}:${i.variantSku}`} className={`card flex gap-4 p-3 hover:shadow-elev-1 ${i.available ? "" : "opacity-70"}`}>
              {i.image ? <img src={i.image.url} alt={i.image.alt} loading="lazy" referrerPolicy="no-referrer" className="h-24 w-24 shrink-0 rounded-md object-cover" /> : <div className="h-24 w-24 shrink-0 rounded-md bg-sandal-100" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.available ? <Link href={`/product/${i.slug}`} className="hover:text-primary">{i.name}</Link> : i.name}</p>
                {Object.keys(i.options).length > 0 && <p className="text-sm text-muted">{Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>}
                {i.available ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="text-sm" htmlFor={`q-${i.productId}-${i.variantSku}`}>Qty</label>
                    <input id={`q-${i.productId}-${i.variantSku}`} type="number" min={1} max={Math.min(MAX_QTY, i.maxQty)} value={i.qty} className="input h-9 w-20"
                      onChange={(e) => { cart.setQty(i.productId, i.variantSku, Math.min(Math.min(MAX_QTY, i.maxQty), Math.max(1, Math.trunc(Number(e.target.value) || 1)))); }} />
                    <button type="button" className="btn-ghost btn-sm" onClick={() => { cart.remove(i.productId, i.variantSku); setAnnounce(`${i.name} removed from your cart`); }}>Remove<span className="sr-only"> {i.name}</span></button>
                  </div>
                ) : (
                  <button type="button" className="btn-outline btn-sm mt-2" onClick={() => { cart.remove(i.productId, i.variantSku); setAnnounce(`${i.name} removed from your cart`); }}>Remove unavailable item<span className="sr-only"> {i.name}</span></button>
                )}
              </div>
              <p className="shrink-0 text-right font-semibold">{i.available ? formatPaise(i.lineTotal) : "—"}</p>
            </li>
          ))}
        </ul>
      </div>

      <aside aria-labelledby="summary" className="card h-fit space-y-3 p-5 hover:shadow-elev-1">
        <h2 id="summary" className="font-sans text-lg font-semibold">Order summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPaise(data.pricing.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{data.pricing.shipping === 0 ? "Free" : formatPaise(data.pricing.shipping)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatPaise(data.pricing.total)}</dd></div>
        </dl>
        <p className="text-xs text-muted">Inclusive of all taxes.{data.pricing.shipping > 0 && data.pricing.freeShippingOver > 0 && <> Free shipping on orders over {formatPaise(data.pricing.freeShippingOver)}.</>}</p>
        {buyable.length > 0
          ? <Link href="/checkout" className="btn-primary w-full">Checkout</Link>
          : <p className="text-sm text-danger">Nothing in your cart can be purchased right now.</p>}
        <Link href="/" className="btn-ghost w-full">Continue shopping</Link>
      </aside>
    </div>
  );
}
