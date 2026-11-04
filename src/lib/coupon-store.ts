"use client";

import { useSyncExternalStore } from "react";

/** The coupon code a shopper typed, kept in the browser next to the cart. The server re-checks it on every price. */
const KEY = "gp_coupon_v1";
const listeners = new Set<() => void>();
let cache = "";

function read(): string {
  try { cache = localStorage.getItem(KEY) ?? ""; } catch { /* storage blocked: the code lasts for this page view */ }
  return cache;
}
export function setCoupon(code: string) {
  cache = code.trim().toUpperCase();
  try {
    if (cache) localStorage.setItem(KEY, cache);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export const clearCoupon = () => setCoupon("");

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
};
export const useCoupon = () => useSyncExternalStore(subscribe, read, () => "");
