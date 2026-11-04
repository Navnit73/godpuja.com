import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import PageBand from "@/components/store/PageBand";
import { allCountries, countryName } from "@/lib/address";
import { currentUser } from "@/server/auth/guard";
import { getProfile, listAddresses } from "@/server/services/account";
import { shippingCountries } from "@/server/services/orders";
import CheckoutClient, { type CheckoutAccount } from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

/**
 * Country lists are built on the server at request time: SHIPPING_COUNTRIES is runtime configuration (it must not be
 * frozen into the prerendered shell), and ICU country names can differ between the server and the browser.
 * connection() also marks the page as request-time for the store layout's dynamic metadata.
 */
async function Checkout() {
  await connection();
  const user = await currentUser();
  let account: CheckoutAccount | null = null;
  if (user) {
    const [profile, addresses] = await Promise.all([getProfile(String(user._id)), listAddresses(String(user._id))]);
    account = { email: profile.email, phone: profile.phone, name: profile.name, addresses: addresses.map((a) => ({ ...a, label: a.label ?? "", phone: a.phone ?? "" })) };
  }
  return <CheckoutClient shipTo={shippingCountries().map((code) => ({ code, name: countryName(code) ?? code }))} billTo={allCountries()} account={account} />;
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
