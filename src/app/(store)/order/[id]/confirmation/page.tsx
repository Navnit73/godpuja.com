import type { Metadata } from "next";
import { Suspense } from "react";
import ConfirmationClient from "./ConfirmationClient";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false, follow: false }, referrer: "no-referrer" }; // the URL carries a secret token

export default function ConfirmationPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      {/* reads the URL (order id + token) on the client, so it must sit inside Suspense */}
      <Suspense fallback={<p role="status" className="text-muted">Loading your order…</p>}>
        <ConfirmationClient />
      </Suspense>
    </main>
  );
}
