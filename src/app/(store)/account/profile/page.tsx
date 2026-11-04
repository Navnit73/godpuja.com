import type { Metadata } from "next";
import { Suspense } from "react";
import { allCountries } from "@/lib/address";
import { requireAccount } from "@/server/auth/guard";
import { getProfile } from "@/server/services/account";
import AccountShell, { Loading } from "../AccountShell";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = { title: "Profile & security", robots: { index: false, follow: false } };

// Display currencies offered for now (multi-currency checkout is Phase 3; this is a preference only).
const CURRENCIES = ["INR", "USD", "GBP", "EUR", "CAD", "AUD", "AED", "SGD", "NZD"];

async function Profile() {
  const user = await requireAccount("/account/profile");
  const zones = Intl.supportedValuesOf("timeZone");
  return <ProfileClient initial={await getProfile(String(user._id))} countries={allCountries()} currencies={CURRENCIES} timeZones={zones} />;
}

export default function ProfilePage() {
  return <AccountShell active="profile" title="Profile & security" crumbs={[{ name: "Profile" }]}><Suspense fallback={<Loading />}><Profile /></Suspense></AccountShell>;
}
