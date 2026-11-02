import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getFooter } from "@/server/services/footer";
import { listLinkablePages } from "@/server/services/menus";
import FooterEditor from "./FooterEditor";

export const metadata: Metadata = { title: "Footer" };

export default async function FooterAdmin() {
  const user = await currentUser();
  if (!user || !can(user.role, "footer:write")) return <Forbidden />;
  const footer = await getFooter();
  const refs = [...footer.columns.flatMap((c) => c.links), ...footer.legalLinks].flatMap((l) => (l.ref ? [l.ref] : []));
  const { pages, truncated } = await listLinkablePages(refs);
  return (
    <>
      <PageHeader title="Footer" description="Columns, contact details, social links, newsletter and legal links shown at the bottom of every storefront page." />
      <FooterEditor initial={footer} pages={pages} pagesTruncated={truncated} />
    </>
  );
}
