import type { Metadata } from "next";
import { Suspense } from "react";
import { allCountries } from "@/lib/address";
import { requireAccount } from "@/server/auth/guard";
import { listAddresses } from "@/server/services/account";
import { shippingCountries } from "@/server/services/orders";
import AccountShell, { Loading } from "../AccountShell";
import AddressesClient from "./AddressesClient";

export const metadata: Metadata = { title: "My addresses", robots: { index: false, follow: false } };

async function Addresses() {
  const user = await requireAccount("/account/addresses");
  return <AddressesClient initial={await listAddresses(String(user._id))} countries={allCountries()} shipTo={shippingCountries()} />;
}

export default function AddressesPage() {
  return <AccountShell active="addresses" title="My addresses" crumbs={[{ name: "Addresses" }]}><Suspense fallback={<Loading />}><Addresses /></Suspense></AccountShell>;
}
