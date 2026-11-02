import type { Metadata } from "next";
import PageBand from "@/components/store/PageBand";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <PageBand title="Checkout" crumbs={[{ name: "Home", href: "/" }, { name: "Cart", href: "/cart" }, { name: "Checkout" }]} />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <CheckoutClient />
      </div>
    </main>
  );
}
