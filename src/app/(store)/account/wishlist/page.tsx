import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ProductCard from "@/components/store/ProductCard";
import { requireAccount } from "@/server/auth/guard";
import { listWishlist } from "@/server/services/wishlist";
import AccountShell, { Loading } from "../AccountShell";

export const metadata: Metadata = { title: "My wishlist", robots: { index: false, follow: false } };

async function Wishlist() {
  const user = await requireAccount("/account/wishlist");
  const items = await listWishlist(String(user._id));
  if (items.length === 0) {
    return (
      <div className="panel px-6 py-12 text-center">
        <p className="text-lg font-semibold">Nothing saved yet</p>
        <p className="mt-2 text-sm text-muted">Tap the heart on a product to keep it here.</p>
        <Link href="/shop" className="btn-primary mt-5">Browse the shop</Link>
      </div>
    );
  }
  return (
    <section aria-labelledby="wl">
      <h2 id="wl" className="sr-only">Saved products</h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{items.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
    </section>
  );
}

export default function WishlistPage() {
  return <AccountShell active="wishlist" title="My wishlist" crumbs={[{ name: "Wishlist" }]}><Suspense fallback={<Loading />}><Wishlist /></Suspense></AccountShell>;
}
