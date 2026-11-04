import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { requireAccount } from "@/server/auth/guard";
import { getProfile, listAddresses, listMyOrders } from "@/server/services/account";
import AccountShell, { Loading } from "./AccountShell";
import VerifyBanner from "./VerifyBanner";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };
const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

async function Overview() {
  const user = await requireAccount("/account");
  const id = String(user._id);
  const [profile, orders, addresses] = await Promise.all([getProfile(id), listMyOrders(id, 1, 3), listAddresses(id)]);
  const first = profile.name.split(/\s+/)[0];
  return (
    <div className="space-y-6">
      {!profile.emailVerified && <VerifyBanner email={profile.email} />}
      <p className="text-lg">Namaste, <strong>{first}</strong>.</p>
      <section aria-labelledby="recent" className="panel p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent" className="font-sans text-lg font-semibold">Recent orders</h2>
          {orders.total > 0 && <Link href="/account/orders" className="text-sm font-medium text-primary underline">All orders ({orders.total})</Link>}
        </div>
        {orders.items.length === 0 ? (
          <p className="text-sm text-muted">No orders yet. <Link href="/" className="text-primary underline">Start shopping</Link>.</p>
        ) : (
          <ul className="divide-y divide-border">
            {orders.items.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <Link href={`/account/orders/${o.id}`} className="font-medium hover:text-primary">{o.orderNumber}</Link>
                <span className="text-muted">{DATE.format(new Date(o.createdAt))}</span>
                <span>{ORDER_STATUS_LABEL[o.status]}</span>
                <span className="font-medium">{formatMoney(o.total, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="addr" className="panel p-5">
          <h2 id="addr" className="mb-2 font-sans text-lg font-semibold">Addresses</h2>
          <p className="text-sm text-muted">{addresses.length ? `${addresses.length} saved` : "None saved yet"}</p>
          <Link href="/account/addresses" className="btn-outline btn-sm mt-3">Manage addresses</Link>
        </section>
        <section aria-labelledby="prof" className="panel p-5">
          <h2 id="prof" className="mb-2 font-sans text-lg font-semibold">Profile</h2>
          <p className="truncate text-sm text-muted">{profile.email}{profile.emailVerified && " · verified"}</p>
          <Link href="/account/profile" className="btn-outline btn-sm mt-3">Edit profile</Link>
        </section>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return <AccountShell active="overview" title="My account"><Suspense fallback={<Loading />}><Overview /></Suspense></AccountShell>;
}
