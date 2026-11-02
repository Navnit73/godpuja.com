import type { Metadata } from "next";
import PageBand from "@/components/store/PageBand";
import CartClient from "./CartClient";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <PageBand title="Your cart" crumbs={[{ name: "Home", href: "/" }, { name: "Cart" }]} />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <CartClient />
      </div>
    </main>
  );
}
