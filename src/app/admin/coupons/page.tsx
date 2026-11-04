import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listCoupons } from "@/server/services/coupons";
import CouponsClient from "./CouponsClient";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const user = await currentUser();
  if (!user || !can(user.role, "coupons:write")) return <Forbidden />;
  return (
    <>
      <PageHeader title="Coupons" description="Discount codes customers enter in the cart or at checkout. Limits are enforced when the order is placed." />
      <CouponsClient initial={await listCoupons()} />
    </>
  );
}
