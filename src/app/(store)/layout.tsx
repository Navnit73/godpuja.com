import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { env } from "@/server/env";
import { getSiteSettings } from "@/server/public/settings";
import SiteFooter, { FooterShell } from "@/components/store/SiteFooter";
import SiteHeader, { HeaderShell } from "@/components/store/SiteHeader";

/** Site-wide SEO defaults from /admin/seo; each page fills in its own title, description and canonical. */
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const s = await getSiteSettings();
  return {
    metadataBase: new URL(env().SITE_URL),
    title: { default: s.defaultTitle, template: `%s — ${s.siteName}` },
    description: s.defaultDescription,
    openGraph: { siteName: s.siteName, locale: "en_IN", type: "website", images: s.defaultOgImage ? [{ url: s.defaultOgImage }] : undefined },
    twitter: { card: s.defaultOgImage ? "summary_large_image" : "summary", site: s.twitterHandle || undefined },
  };
}

// Storefront chrome. Admin and login sit outside this group and keep their own layouts.
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<HeaderShell />}>
        <SiteHeader />
      </Suspense>
      {children}
      <Suspense fallback={<FooterShell />}>
        <SiteFooter />
      </Suspense>
    </>
  );
}
