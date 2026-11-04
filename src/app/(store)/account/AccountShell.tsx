import Link from "next/link";
import type { ReactNode } from "react";
import PageBand from "@/components/store/PageBand";

const TABS = [
  { href: "/account", label: "Overview", key: "overview" },
  { href: "/account/orders", label: "Orders", key: "orders" },
  { href: "/account/wishlist", label: "Wishlist", key: "wishlist" },
  { href: "/account/addresses", label: "Addresses", key: "addresses" },
  { href: "/account/profile", label: "Profile & security", key: "profile" },
] as const;
export type AccountTab = (typeof TABS)[number]["key"];

/** Frame for every /account page: title band, tab navigation (current page marked for screen readers), content. */
export default function AccountShell({ active, title, crumbs = [], children }: { active: AccountTab; title: string; crumbs?: { name: string; href?: string }[]; children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <PageBand title={title} crumbs={[{ name: "Home", href: "/" }, { name: "My account", href: "/account" }, ...crumbs]} />
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* min-w-0 + grid-cols-1 (minmax(0,1fr)): without them the scrollable tab list sizes the whole page column to its content and the page scrolls sideways on phones. */}
        <nav aria-label="My account" className="min-w-0">
          <ul className="flex gap-2 overflow-x-auto scrollbar-none lg:flex-col">
            {TABS.map((t) => (
              <li key={t.key}>
                <Link href={t.href} aria-current={t.key === active ? "page" : undefined}
                  className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${t.key === active ? "bg-saffron-50 text-primary" : "text-foreground hover:bg-sandal-100"}`}>
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}

export const Loading = () => <p role="status" className="text-muted">Loading…</p>;
