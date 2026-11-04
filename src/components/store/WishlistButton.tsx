"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadWishlist, toggleWishlist, useWishlist } from "@/lib/wishlist-store";

const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.6 4.5 6.4 4.5c2 0 3.6 1 4.6 2.6l1 1.5 1-1.5c1-1.6 2.6-2.6 4.6-2.6 3.8 0 5.5 3.9 4 7.3C19.5 16.4 12 21 12 21z";

/**
 * Heart toggle. Signed-out visitors are sent to sign in and come back to this page. Not inside a link: it sits beside it.
 * `compact` is the round overlay for product cards; the default is a labelled button for the product page.
 */
export default function WishlistButton({ productId, name, compact = false }: { productId: string; name: string; compact?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const { status, ids } = useWishlist();
  const [error, setError] = useState(false);
  useEffect(() => { loadWishlist(); }, []);
  const saved = ids.has(productId);

  async function click() {
    setError(false);
    if (status === "out") { router.push(`/login?next=${encodeURIComponent(path)}`); return; }
    try { await toggleWishlist(productId); } catch { setError(true); }
  }
  const label = saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`;
  const icon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={HEART} /></svg>;
  if (compact) {
    return (
      <button type="button" onClick={click} aria-pressed={saved} aria-label={label} title={error ? "Could not update. Try again." : undefined}
        className={`absolute right-2 top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 shadow-elev-1 transition-colors hover:bg-surface ${saved ? "text-kumkum-700" : "text-foreground"}`}>
        {icon}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={click} aria-pressed={saved} className={`btn-outline gap-2 ${saved ? "text-kumkum-700" : ""}`}>{icon}{saved ? "Saved to wishlist" : "Save to wishlist"}</button>
      {error && <span role="alert" className="mt-1 text-xs text-danger">Could not update your wishlist. Try again.</span>}
    </span>
  );
}
