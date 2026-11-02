"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart";
import { CartIcon } from "./Icons";

export default function CartLink() {
  const n = cartCount(useCart());
  return (
    <Link href="/cart" className="icon-btn md:w-auto md:gap-2 md:px-3">
      <span className="relative">
        <CartIcon />
        {n > 0 && <span className="absolute -right-2.5 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground ring-2 ring-surface" aria-hidden="true">{n > 99 ? "99+" : n}</span>}
      </span>
      <span className="hidden text-sm font-medium md:inline" aria-hidden="true">Cart</span>
      <span className="sr-only">Cart{n > 0 ? `, ${n} ${n === 1 ? "item" : "items"}` : ", empty"}</span>
    </Link>
  );
}
