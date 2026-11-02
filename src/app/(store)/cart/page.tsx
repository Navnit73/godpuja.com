import type { Metadata } from "next";
import CartClient from "./CartClient";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-4xl font-semibold">Your cart</h1>
      <div className="divider-gold my-6" />
      <CartClient />
    </main>
  );
}
