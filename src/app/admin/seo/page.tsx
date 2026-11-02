import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { listRedirectsSchema } from "@/lib/validation/seo";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listRedirects } from "@/server/services/redirects";
import { getSeoSettings } from "@/server/services/settings";
import SeoClient from "./SeoClient";

export const metadata: Metadata = { title: "SEO" };

export default async function SeoPage({ searchParams }: PageProps<"/admin/seo">) {
  const user = await currentUser();
  if (!user || !can(user.role, "seo:write")) return <Forbidden />;
  const raw = await searchParams;
  const q = listRedirectsSchema.safeParse({ q: typeof raw.q === "string" && raw.q ? raw.q : undefined, page: typeof raw.page === "string" ? raw.page : undefined });
  const query = q.success ? q.data : listRedirectsSchema.parse({});
  const [settings, redirects] = await Promise.all([getSeoSettings(), listRedirects(query)]);
  return (
    <>
      <PageHeader title="SEO" description="Site-wide search engine defaults and URL redirects. Pages, categories and products have their own SEO fields." />
      <SeoClient settings={settings} redirects={redirects} q={query.q ?? ""} />
    </>
  );
}
