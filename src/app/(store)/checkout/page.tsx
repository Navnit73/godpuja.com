import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import PageBand from "@/components/store/PageBand";
import { allCountries, countryName } from "@/lib/address";
import { shippingCountries } from "@/server/services/orders";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

/**
 * Country lists are built on the server at request time: SHIPPING_COUNTRIES is runtime configuration (it must not be
 * frozen into the prerendered shell), and ICU country names can differ between the server and the browser.
 * connection() also marks the page as request-time for the store layout's dynamic metadata.
 */
async function Checkout() {
  await connection();
  return <CheckoutClient shipTo={shippingCountries().map((code) => ({ code, name: countryName(code) ?? code }))} billTo={allCountries()} />;
}

export default function CheckoutPage() {
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <PageBand title="Checkout" crumbs={[{ name: "Home", href: "/" }, { name: "Cart", href: "/cart" }, { name: "Checkout" }]} />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
          <Checkout />
        </Suspense>
      </div>
    </main>
  );
}
