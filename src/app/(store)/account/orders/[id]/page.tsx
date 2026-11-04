import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import OrderDetails from "@/components/store/OrderDetails";
import { ApiError } from "@/server/api";
import { requireAccount } from "@/server/auth/guard";
import { getMyOrder } from "@/server/services/account";
import AccountShell, { Loading } from "../../AccountShell";
import { invoiceable } from "@/lib/order-status";
import OrderActions from "./OrderActions";

export const metadata: Metadata = { title: "Order details", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function Detail({ params }: { params: PageProps<"/account/orders/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireAccount(`/account/orders/${id}`);
  const order = await getMyOrder(String(user._id), id).catch((e) => { if (e instanceof ApiError && e.code === "NOT_FOUND") notFound(); throw e; });
  return (
    <div className="space-y-6">
      <OrderDetails o={order} />
      <OrderActions id={id} actions={order.actions} delivered={order.status === "delivered"} hasReturn={!!order.returnRequest} />
      <div className="flex flex-wrap gap-2">
        <Link href="/account/orders" className="btn-ghost">← All orders</Link>
        {invoiceable(order.status) && <Link href={`/account/orders/${id}/invoice`} className="btn-outline">View invoice</Link>}
      </div>
    </div>
  );
}

export default function OrderPage({ params }: PageProps<"/account/orders/[id]">) {
  return <AccountShell active="orders" title="Order details" crumbs={[{ name: "Orders", href: "/account/orders" }, { name: "Details" }]}><Suspense fallback={<Loading />}><Detail params={params} /></Suspense></AccountShell>;
}
