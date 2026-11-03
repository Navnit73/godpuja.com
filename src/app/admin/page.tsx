import type { Metadata } from "next";
import Link from "next/link";
import Icon, { type IconName } from "@/components/admin/icons";
import Forbidden from "@/components/ui/Forbidden";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listOrders } from "@/server/services/orders";
import { listProducts } from "@/server/services/products";
import { userStats } from "@/server/services/users";
import { PaymentBadge, StatusBadge } from "./orders/badges";

export const metadata: Metadata = { title: "Dashboard" };

const TONE = {
  saffron: "bg-saffron-100 text-saffron-700",
  kumkum: "bg-kumkum-100 text-kumkum-700",
  gold: "bg-gold-100 text-gold-700",
  tulsi: "bg-tulsi-100 text-tulsi-700",
} as const;

type Stat = { label: string; value: string | number; hint?: string; icon: IconName; tone: keyof typeof TONE; href?: string };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const user = await currentUser();
  if (!user || !can(user.role, "dashboard:read")) return <Forbidden />;
  const canOrders = can(user.role, "orders:read");
  const canProducts = can(user.role, "products:read");

  const [users, orders, products, lowStock] = await Promise.all([
    can(user.role, "users:read") ? userStats() : null,
    canOrders ? listOrders({ page: 1, limit: 6 }) : null,
    canProducts ? listProducts({ page: 1, limit: 1 }) : null,
    canProducts ? listProducts({ page: 1, limit: 5, lowStock: "1" }) : null,
  ]);

  const stats: Stat[] = [];
  if (orders) stats.push({ label: "Total orders", value: orders.total.toLocaleString("en-IN"), icon: "orders", tone: "saffron", href: "/admin/orders" });
  if (products) stats.push({ label: "Products", value: products.total.toLocaleString("en-IN"), icon: "products", tone: "gold", href: "/admin/products" });
  if (lowStock) stats.push({ label: "Low stock", value: lowStock.total, hint: lowStock.total ? "Needs restock" : "All stocked", icon: "alert", tone: lowStock.total ? "kumkum" : "tulsi", href: "/admin/inventory?lowStock=1" });
  if (users) stats.push({ label: "Customers", value: users.customers.toLocaleString("en-IN"), hint: `${users.staff} staff`, icon: "users", tone: "tulsi", href: "/admin/users" });

  const actions: { label: string; href: string; icon: IconName; show: boolean }[] = [
    { label: "Add product", href: "/admin/products/new", icon: "products", show: can(user.role, "products:write") },
    { label: "New page", href: "/admin/pages/new", icon: "pages", show: can(user.role, "pages:write") },
    { label: "Edit homepage", href: "/admin/homepage", icon: "home", show: can(user.role, "home:write") },
    { label: "Upload media", href: "/admin/media", icon: "media", show: can(user.role, "media:write") },
  ];
  const quick = actions.filter((a) => a.show);

  return (
    <>
      {/* Hero */}
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-sacred p-6 text-white sm:p-8">
        <div aria-hidden="true" className="pattern-rangoli absolute inset-0 opacity-60" />
        <div aria-hidden="true" className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-gold-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-200">{greeting()}</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">Namaste, {user.name.split(" ")[0]}</h1>
            <p className="mt-2 max-w-lg text-sandal-100">Here is what is happening across your store today.</p>
          </div>
          {quick.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quick.map((a) => (
                <Link key={a.href} href={a.href} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/25 transition-colors hover:bg-white/25">
                  <Icon name={a.icon} className="h-4 w-4" />{a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      {stats.length > 0 && (
        <ul aria-label="Store at a glance" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <li key={s.label} className="stat-card group transition-colors hover:border-saffron-300">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-muted">{s.label}</p>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE[s.tone]}`}><Icon name={s.icon} /></span>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-kumkum-900">{s.value}</p>
              {s.hint && <p className="mt-1 text-xs text-muted">{s.hint}</p>}
              {s.href && <Link href={s.href} className="absolute inset-0 rounded-2xl" aria-label={`View ${s.label.toLowerCase()}`} />}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {orders && (
          <section className="card overflow-hidden p-0 xl:col-span-2" aria-labelledby="recent-orders">
            <div className="flex items-center justify-between border-b border-sandal-200 px-5 py-4">
              <h2 id="recent-orders" className="font-sans text-base font-semibold">Recent orders</h2>
              <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View all <Icon name="chevron" className="h-4 w-4" /></Link>
            </div>
            {orders.items.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted">No orders yet. They will show up here as soon as customers check out.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Recent orders</caption>
                  <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col">Payment</th></tr></thead>
                  <tbody>
                    {orders.items.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-primary">{o.orderNumber}</Link><span className="block text-xs text-muted">{formatDateTime(o.createdAt)}</span></td>
                        <td>{o.name}</td>
                        <td className="whitespace-nowrap font-medium">{formatMoney(o.total, o.currency)}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td><PaymentBadge status={o.paymentStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {lowStock && (
          <section className="card overflow-hidden p-0" aria-labelledby="low-stock">
            <div className="flex items-center justify-between border-b border-sandal-200 px-5 py-4">
              <h2 id="low-stock" className="font-sans text-base font-semibold">Low stock</h2>
              <Link href="/admin/inventory?lowStock=1" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Inventory <Icon name="chevron" className="h-4 w-4" /></Link>
            </div>
            {lowStock.items.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted">Everything is well stocked.</p>
            ) : (
              <ul className="divide-y divide-sandal-200">
                {lowStock.items.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    {p.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-sandal-200 object-cover" />
                      : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sandal-100 text-muted"><Icon name="products" className="h-4 w-4" /></span>}
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/products/${p.id}`} className="block truncate text-sm font-medium hover:text-primary">{p.name}</Link>
                      <p className="text-xs text-muted">{p.sku}</p>
                    </div>
                    <span className={p.stock === 0 ? "badge-danger" : "badge-primary"}>{p.stock === 0 ? "Out" : `${p.stock} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
