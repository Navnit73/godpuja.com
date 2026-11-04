"use client";

import { useSyncExternalStore } from "react";
import { api, ApiClientError } from "./api";

/**
 * The signed-in shopper's saved product ids, loaded once and shared by every heart on the page. Product pages are cached
 * and the same for everyone, so this is fetched in the browser. `status` is "out" for visitors who are not signed in.
 */
type State = { status: "idle" | "loading" | "ready" | "out"; ids: ReadonlySet<string> };
let state: State = { status: "idle", ids: new Set() };
const listeners = new Set<() => void>();
const set = (s: State) => { state = s; listeners.forEach((l) => l()); };
/** The initial "what is saved?" request. A click waits for it, so its (older) answer can never overwrite a newer change. */
let loading: Promise<void> | null = null;

export function loadWishlist() {
  if (state.status !== "idle") return;
  set({ ...state, status: "loading" });
  loading = api.get<{ ids: string[] }>("/account/wishlist")
    .then((r) => set({ status: "ready", ids: new Set(r.ids) }))
    .catch((e) => set({ status: e instanceof ApiClientError && e.status === 401 ? "out" : "idle", ids: new Set() }))
    .finally(() => { loading = null; });
}
/** Forget what we know (after sign in or out) so the next heart asks again. */
export const resetWishlist = () => { loading = null; set({ status: "idle", ids: new Set() }); };

/** Save or remove a product; the heart changes at once and goes back if the server says no. Throws on failure. */
export async function toggleWishlist(productId: string) {
  if (loading) await loading; // know what is saved before changing it
  if (state.status === "out") throw new ApiClientError("UNAUTHENTICATED", "Please sign in", 401);
  const had = state.ids.has(productId);
  const next = new Set(state.ids);
  if (had) next.delete(productId); else next.add(productId);
  set({ ...state, ids: next });
  try {
    if (had) await api.delete(`/account/wishlist/${productId}`); else await api.post("/account/wishlist", { productId });
  } catch (e) {
    const back = new Set(state.ids);
    if (had) back.add(productId); else back.delete(productId);
    set({ ...state, ids: back });
    throw e;
  }
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const EMPTY: State = { status: "idle", ids: new Set() };
export const useWishlist = () => useSyncExternalStore(subscribe, () => state, () => EMPTY);
