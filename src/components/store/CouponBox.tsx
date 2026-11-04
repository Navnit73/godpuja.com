"use client";

import { useState } from "react";
import { clearCoupon, setCoupon } from "@/lib/coupon-store";
import type { CartCoupon } from "@/lib/storefront-api";

/** "Have a coupon?" The server decides whether the code works; its message is shown as is. */
export default function CouponBox({ code, applied, error, loading }: { code: string; applied: CartCoupon | null; error: string | null; loading: boolean }) {
  const [text, setText] = useState("");
  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-success-soft px-3 py-2 text-sm" role="status">
        <span><strong>{applied.code}</strong> applied</span>
        <button type="button" className="text-xs font-medium text-primary underline" onClick={clearCoupon}>Remove<span className="sr-only"> coupon {applied.code}</span></button>
      </div>
    );
  }
  return (
    <form className="space-y-1" noValidate onSubmit={(e) => { e.preventDefault(); if (text.trim()) { setCoupon(text); setText(""); } }}>
      <label htmlFor="coupon" className="label">Coupon code</label>
      <div className="flex gap-2">
        <input id="coupon" className="input uppercase" value={text} maxLength={30} autoComplete="off" aria-invalid={!!(error && code)} aria-describedby={error && code ? "coupon-err" : undefined} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn-outline shrink-0" disabled={loading || !text.trim()}>Apply</button>
      </div>
      {error && code && (
        <p id="coupon-err" role="alert" className="field-error">{error} <button type="button" className="underline" onClick={clearCoupon}>Clear</button></p>
      )}
    </form>
  );
}
