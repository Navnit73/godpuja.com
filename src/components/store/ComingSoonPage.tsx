import type { Metadata } from "next";
import Link from "next/link";
import { COMING_SOON, type ComingSoonKey } from "@/lib/pillars";
import PageBand from "./PageBand";

export const comingSoonMetadata = (key: ComingSoonKey): Metadata => ({
  title: COMING_SOON[key].title, description: COMING_SOON[key].text,
  robots: { index: false, follow: true }, // a placeholder must not compete with the real page when it ships
});

/** Placeholder for a pillar that has not shipped yet (Temples, Book a Pooja, Donate). */
export default function ComingSoonPage({ k }: { k: ComingSoonKey }) {
  const c = COMING_SOON[k];
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <PageBand title={c.title} crumbs={[{ name: "Home", href: "/" }, { name: c.title }]} />
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6">
        <p className="badge-primary">Coming soon</p>
        <p className="mt-4 text-lg">{c.text}</p>
        <p className="mt-6 text-muted">In the meantime, explore what is ready today.</p>
        <p className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="btn-primary">Shop</Link>
          <Link href="/pooja-vidhi" className="btn-outline">Pooja Vidhi</Link>
          <Link href="/aarti" className="btn-outline">Aarti & Mantras</Link>
        </p>
      </div>
    </main>
  );
}
