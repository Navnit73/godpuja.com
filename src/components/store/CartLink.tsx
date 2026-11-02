"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart";

export default function CartLink() {
  const n = cartCount(useCart());
  return (
    <Link href="/cart" className="relative rounded-md px-3 py-2 text-sm font-medium hover:bg-sandal-100">
      Cart{n > 0 && <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground" aria-hidden="true">{n}</span>}
      <span className="sr-only">{n > 0 ? `, ${n} ${n === 1 ? "item" : "items"}` : ", empty"}</span>
    </Link>
  );
}
