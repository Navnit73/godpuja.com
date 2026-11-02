"use client";

import { useSyncExternalStore } from "react";

/** The cart lives in the browser only (no account needed); prices and stock are always re-checked by the server. */
export type CartLine = { productId: string; variantSku: string | null; qty: number };
export const MAX_QTY = 20;
export const MAX_LINES = 30;
const KEY = "gp_cart_v1";

const EMPTY: CartLine[] = [];
let cache: CartLine[] = EMPTY;
let raw: string | null = null;
const listeners = new Set<() => void>();

function parse(text: string | null): CartLine[] {
  if (!text) return EMPTY;
  try {
    const v = JSON.parse(text);
    if (!Array.isArray(v)) return EMPTY;
    return v
      .filter((l) => l && typeof l.productId === "string" && /^[a-f0-9]{24}$/.test(l.productId) && Number.isInteger(l.qty) && l.qty >= 1)
      .slice(0, MAX_LINES)
      .map((l) => ({ productId: l.productId, variantSku: typeof l.variantSku === "string" ? l.variantSku : null, qty: Math.min(MAX_QTY, l.qty) }));
  } catch {
    return EMPTY;
  }
}

function read(): CartLine[] {
  let text: string | null = null;
  try { text = localStorage.getItem(KEY); } catch { /* storage blocked: cart works for this page view only */ }
  if (text !== raw) { raw = text; cache = parse(text); } // stable reference unless the stored value changed
  return cache;
}

function write(lines: CartLine[]) {
  const text = JSON.stringify(lines);
  try { localStorage.setItem(KEY, text); } catch { /* ignore */ }
  raw = text; cache = lines.length ? lines : EMPTY;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); }; // other tabs
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
};

export const useCart = () => useSyncExternalStore(subscribe, read, () => EMPTY);
export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);

const same = (a: CartLine, productId: string, variantSku: string | null) => a.productId === productId && a.variantSku === variantSku;

export const cart = {
  add(productId: string, variantSku: string | null, qty = 1) {
    const lines = read();
    const i = lines.findIndex((l) => same(l, productId, variantSku));
    if (i >= 0) return write(lines.map((l, n) => (n === i ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l)));
    if (lines.length >= MAX_LINES) return;
    write([...lines, { productId, variantSku, qty: Math.min(MAX_QTY, qty) }]);
  },
  setQty(productId: string, variantSku: string | null, qty: number) {
    const q = Math.min(MAX_QTY, Math.max(0, Math.trunc(qty)));
    write(read().flatMap((l) => (same(l, productId, variantSku) ? (q === 0 ? [] : [{ ...l, qty: q }]) : [l])));
  },
  remove(productId: string, variantSku: string | null) { write(read().filter((l) => !same(l, productId, variantSku))); },
  clear() { write([]); },
};
