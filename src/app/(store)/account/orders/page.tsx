import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { requireAccount } from "@/server/auth/guard";
import { listMyOrders } from "@/server/services/account";
import AccountShell, { Loading } from "../AccountShell";

export const metadata: Metadata = { title: "My orders", robots: { index: false, follow: false } };
const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

async function Orders({ searchParams }: { searchParams: PageProps<"/account/orders">["searchParams"] }) {
  const user = await requireAccount("/account/orders");
  const raw = Number((await searchParams).page);
  const page = Number.isInteger(raw) && raw >= 1 && raw <= 1000 ? raw : 1;
  const r = await listMyOrders(String(user._id), page, 10);
  if (r.total === 0) {
    return (
      <div className="panel px-6 py-12 text-center">
        <p className="text-lg font-semibold">No orders yet</p>
        <p className="mt-2 text-sm text-muted">Orders you placed as a guest appear here once you confirm your email.</p>
        <Link href="/" className="btn-primary mt-5">Start shopping</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="panel overflow-x-auto p-0">
        <table className="data-table">
          <caption className="sr-only">Your orders, newest first</caption>
          <thead><tr><th scope="col">Order</th><th scope="col">Placed</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {r.items.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/account/orders/${o.id}`} className="font-medium hover:text-primary">{o.orderNumber}</Link></td>
                <td className="whitespace-nowrap">{DATE.format(new Date(o.createdAt))}</td>
                <td>{o.itemCount}</td>
                <td className="whitespace-nowrap">{formatMoney(o.total, o.currency)}</td>
                <td>{ORDER_STATUS_LABEL[o.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <p className="text-muted">Page {r.page} of {r.pages}</p>
          <div className="flex gap-2">
            {r.page > 1 && <Link className="btn-outline btn-sm" href={`/account/orders?page=${r.page - 1}`}>Previous</Link>}
            {r.page < r.pages && <Link className="btn-outline btn-sm" href={`/account/orders?page=${r.page + 1}`}>Next</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}

export default function OrdersPage({ searchParams }: PageProps<"/account/orders">) {
  return <AccountShell active="orders" title="My orders" crumbs={[{ name: "Orders" }]}><Suspense fallback={<Loading />}><Orders searchParams={searchParams} /></Suspense></AccountShell>;
}
