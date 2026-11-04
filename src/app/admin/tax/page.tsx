import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { allCountries } from "@/lib/address";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listTaxRules } from "@/server/services/tax";
import TaxClient from "./TaxClient";

export const metadata: Metadata = { title: "Tax rules" };

export default async function TaxPage() {
  const user = await currentUser();
  if (!user || !can(user.role, "tax:write")) return <Forbidden />;
  return (
    <>
      <PageHeader title="Tax rules" description="One rule per destination country. A country with no rule has no tax line. Confirm rates with your accountant." />
      <TaxClient initial={await listTaxRules()} countries={allCountries()} />
    </>
  );
}
