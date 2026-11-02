import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { ApiError } from "@/server/api";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getAdminOrder } from "@/server/services/orders";
import OrderDetail from "../OrderDetail";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const user = await currentUser();
  if (!user || !can(user.role, "orders:read")) return <Forbidden />;
  const order = await getAdminOrder((await params).id).catch((e) => { if (e instanceof ApiError && e.code === "NOT_FOUND") notFound(); throw e; });
  return (
    <>
      <PageHeader title={order.orderNumber} description={`Order for ${order.shippingAddress.name}`} />
      <OrderDetail initial={order} canWrite={can(user.role, "orders:write")} canRefund={can(user.role, "orders:refund")} />
    </>
  );
}
