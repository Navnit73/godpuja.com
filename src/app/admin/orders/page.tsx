import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { listOrdersSchema } from "@/lib/validation/orders";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/server/models/Order";
import { listOrders } from "@/server/services/orders";
import { PAYMENT_LABEL, PaymentBadge, STATUS_LABEL, StatusBadge } from "./badges";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersList({ searchParams }: PageProps<"/admin/orders">) {
  const user = await currentUser();
  if (!user || !can(user.role, "orders:read")) return <Forbidden />;
  const raw = await searchParams;
  const pick = <K extends keyof typeof listOrdersSchema.shape>(key: K) => {
    const v = raw[key];
    const r = listOrdersSchema.shape[key].safeParse(typeof v === "string" && v ? v : undefined);
    return r.success ? r.data : undefined;
  };
  const query = listOrdersSchema.parse({ q: pick("q"), status: pick("status"), payment: pick("payment"), from: pick("from"), to: pick("to"), page: pick("page") });
  const result = await listOrders(query);
  const qs = (page?: number) => {
    const p = new URLSearchParams();
    for (const k of ["q", "status", "payment", "from", "to"] as const) if (query[k]) p.set(k, String(query[k]));
    if (page && page > 1) p.set("page", String(page));
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  if (result.total > 0 && query.page > result.pages) redirect(`/admin/orders${qs(result.pages)}`);
  const filtered = !!(query.q || query.status || query.payment || query.from || query.to);

  return (
    <>
      <PageHeader title="Orders" description="Every order placed on the storefront. Open one to ship it, record payment, add notes or refund."
        actions={<a href={`/api/admin/orders/export${qs()}`} className="btn-outline" download>Export CSV{filtered ? " (filtered)" : ""}</a>} />
      <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={query.q} placeholder="Order no., name, email or phone" className="input" /></div>
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={query.status ?? ""} className="input"><option value="">All</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
        <div><label htmlFor="payment" className="label">Payment</label>
          <select id="payment" name="payment" defaultValue={query.payment ?? ""} className="input"><option value="">All</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}</select></div>
        <div><label htmlFor="from" className="label">From</label><input id="from" name="from" type="date" defaultValue={query.from} className="input" /></div>
        <div><label htmlFor="to" className="label">To</label><input id="to" name="to" type="date" defaultValue={query.to} className="input" /></div>
        <button type="submit" className="btn-outline h-10">Filter</button>
        {filtered && <Link href="/admin/orders" className="btn-ghost h-10">Clear</Link>}
      </form>

      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {result.items.length === 0 ? (
          <EmptyState title={filtered ? "No orders match your filters" : "No orders yet"} description={filtered ? "Try a different search, status or date range." : "Orders appear here as soon as customers check out."} />
        ) : (
          <table className="data-table">
            <caption className="sr-only">Orders</caption>
            <thead><tr><th scope="col">Order</th><th scope="col">Placed</th><th scope="col">Customer</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col">Payment</th></tr></thead>
            <tbody>
              {result.items.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium"><Link href={`/admin/orders/${o.id}`} className="hover:text-primary">{o.orderNumber}</Link></td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(o.createdAt)}</td>
                  <td>{o.name}<span className="block text-xs text-muted">{o.email}</span></td>
                  <td>{o.itemCount}</td>
                  <td className="whitespace-nowrap">{formatMoney(o.total, o.currency)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><PaymentBadge status={o.paymentStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">Page {result.page} of {result.pages} · {result.total} orders</p>
          <div className="flex gap-2">
            {result.page > 1 && <Link className="btn-outline btn-sm" href={`/admin/orders${qs(result.page - 1)}`}>Previous</Link>}
            {result.page < result.pages && <Link className="btn-outline btn-sm" href={`/admin/orders${qs(result.page + 1)}`}>Next</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
