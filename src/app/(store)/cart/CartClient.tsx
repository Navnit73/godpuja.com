"use client";
/* eslint-disable @next/next/no-img-element -- remote product images */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { cart, MAX_QTY, useCart } from "@/lib/cart";
import { useCoupon } from "@/lib/coupon-store";
import CouponBox from "@/components/store/CouponBox";
import PricingLines from "@/components/store/PricingLines";
import { formatMoney } from "@/lib/money";
import type { CartValidation } from "@/lib/storefront-api";
import { sized } from "@/lib/image";
import { CloseIcon } from "@/components/store/Icons";

/** − [n] + control; 44px touch targets on mobile, 40px from sm up. */
function QtyStepper({ name, value, max, onChange }: { name: string; value: number; max: number; onChange: (q: number) => void }) {
  const set = (q: number) => onChange(Math.min(max, Math.max(1, Math.trunc(q) || 1)));
  const btn = "h-11 w-11 text-lg text-foreground hover:bg-sandal-100 focus-visible:bg-sandal-100 disabled:opacity-40 sm:h-10 sm:w-10";
  return (
    <div role="group" aria-label={`Quantity for ${name}`} className="inline-flex items-center overflow-hidden rounded-full border border-input-border bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
      <button type="button" aria-label={`Decrease quantity of ${name}`} disabled={value <= 1} className={btn} onClick={() => set(value - 1)}>−</button>
      <input type="number" inputMode="numeric" aria-label={`Quantity of ${name}`} min={1} max={max} value={value} onChange={(e) => set(Number(e.target.value))}
        className="qty-input h-11 w-10 border-0 bg-transparent text-center text-base font-medium text-foreground outline-none sm:h-10" />
      <button type="button" aria-label={`Increase quantity of ${name}`} disabled={value >= max} className={btn} onClick={() => set(value + 1)}>+</button>
    </div>
  );
}

/** Server-validated cart: prices and stock always come from the API, never from the browser. */
export function useValidatedCart(opts: { country?: string } = {}) {
  const lines = useCart();
  const couponCode = useCoupon();
  const country = opts.country;
  // Everything that changes the price is part of the key, so a stale answer is never shown for the current inputs.
  const key = JSON.stringify([lines, couponCode, country ?? null]);
  const [state, setState] = useState<{ key: string; data: CartValidation | null; error: string | null }>({ key: "", data: null, error: null });
  useEffect(() => {
    if (lines.length === 0) return;
    let live = true;
    api.post<CartValidation>("/cart/validate", { items: lines, ...(couponCode ? { couponCode } : {}), ...(country ? { country } : {}) })
      .then((data) => live && setState({ key, data, error: null }))
      .catch((e) => live && setState({ key, data: null, error: e instanceof ApiClientError ? e.message : "Could not load your cart. Try again." }));
    return () => { live = false; };
  }, [key, lines, couponCode, country]);
  const loading = lines.length > 0 && state.key !== key;
  return { lines, couponCode, loading, data: lines.length ? (state.key === key ? state.data : null) : null, error: state.key === key ? state.error : null };
}

export default function CartClient() {
  const { lines, couponCode, loading, data, error } = useValidatedCart();
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
      <div className="panel px-6 py-16 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted">Find something for your next puja.</p>
        <Link href="/" className="btn-primary mt-5">Continue shopping</Link>
      </div>
    );
  }
  if (error) return <p role="alert" className="alert-error">{error}</p>;
  if (loading || !data) return (
    <div role="status" className="space-y-3"><span className="sr-only">Loading your cart…</span>
      {lines.map((_, n) => <div key={n} className="panel flex animate-pulse gap-3 p-3" aria-hidden="true"><div className="h-20 w-20 rounded-xl bg-sandal-100" /><div className="flex-1 space-y-2 py-1"><div className="h-4 w-2/3 rounded-full bg-sandal-100" /><div className="h-3 w-1/4 rounded-full bg-sandal-100" /></div></div>)}
    </div>
  );

  const buyable = data.items.filter((i) => i.available);
  const remove = (productId: string, variantSku: string | null, name: string) => { cart.remove(productId, variantSku); setAnnounce(`${name} removed from your cart`); };
  return (
    <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-[1fr_20rem]">
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <div className="space-y-4">
        {data.issues.length > 0 && (
          <ul role="status" className="alert-error space-y-1">{data.issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>
        )}
        <ul aria-label="Items in your cart" className="space-y-3">
          {data.items.map((i) => (
            <li key={`${i.productId}:${i.variantSku}`} className={`panel flex gap-3 p-3 sm:gap-4 ${i.available ? "" : "opacity-70"}`}>
              {i.image ? <img src={sized(i.image.url, 192)} alt={i.image.alt} loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-xl bg-sandal-100 object-cover xs:h-20 xs:w-20 sm:h-24 sm:w-24" /> : <div className="h-16 w-16 shrink-0 rounded-xl bg-sandal-100 xs:h-20 xs:w-20 sm:h-24 sm:w-24" aria-hidden="true" />}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-medium leading-snug">{i.available ? <Link href={`/product/${i.slug}`} className="hover:text-primary">{i.name}</Link> : i.name}</p>
                    {Object.keys(i.options).length > 0 && <p className="mt-0.5 text-sm text-muted">{Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>}
                    {i.available && <p className="mt-0.5 text-xs text-muted">{formatMoney(i.unitPrice)} each</p>}
                  </div>
                  {i.available && (
                    <button type="button" className="icon-btn -mr-2 -mt-2 text-muted hover:text-danger" onClick={() => remove(i.productId, i.variantSku, i.name)}>
                      <CloseIcon className="h-5 w-5" /><span className="sr-only">Remove {i.name}</span>
                    </button>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
                  {i.available ? (
                    <QtyStepper name={i.name} value={i.qty} max={Math.min(MAX_QTY, i.maxQty)} onChange={(q) => cart.setQty(i.productId, i.variantSku, q)} />
                  ) : (
                    <button type="button" className="btn-outline btn-sm" onClick={() => remove(i.productId, i.variantSku, i.name)}>Remove<span className="sr-only"> unavailable item {i.name}</span></button>
                  )}
                  <p className="shrink-0 text-right font-semibold">{i.available ? formatMoney(i.lineTotal) : <span className="text-sm font-medium text-danger">Unavailable</span>}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside aria-labelledby="summary" className="panel h-fit space-y-3 p-5">
        <h2 id="summary" className="font-sans text-lg font-semibold">Order summary</h2>
        <CouponBox code={couponCode} applied={data.coupon} error={data.couponError} loading={loading} />
        <PricingLines p={data.pricing} couponCode={data.coupon?.code} />
        <p className="text-xs text-muted">Shipping and any taxes are confirmed at checkout.{data.pricing.shipping > 0 && data.pricing.freeShippingOver > 0 && <> Free shipping on orders over {formatMoney(data.pricing.freeShippingOver)}.</>}</p>
        {buyable.length > 0
          ? <Link href="/checkout" className="btn-primary w-full">Checkout</Link>
          : <p className="text-sm text-danger">Nothing in your cart can be purchased right now.</p>}
        <Link href="/" className="btn-ghost w-full">Continue shopping</Link>
      </aside>
    </div>
  );
}
