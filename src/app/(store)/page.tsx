import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Logo from "@/components/Logo";
import HomeView from "@/components/store/HomeView";
import JsonLd from "@/components/JsonLd";
import { siteLd } from "@/lib/jsonld";
import { getPublicFooter } from "@/server/public/footer";
import { getSiteSettings } from "@/server/public/settings";
import PageView from "@/components/store/PageView";
import { buildPageMetadata } from "@/lib/seo";
import { env } from "@/server/env";
import { getPublicHomepage } from "@/server/public/homepage";
import { getPublicPage } from "@/server/public/pages";

// "/" shows the admin-managed homepage sections. If none are configured yet, it falls back to the published CMS
// page with slug "home" (the Stage 3 behaviour), then to a neutral placeholder. Nothing is hardcoded.
// Rendered at request time (the reads themselves are cached) so the build never needs the database.
async function load() {
  const home = await getPublicHomepage();
  if (home && home.sections.length) return { kind: "sections" as const, home };
  const page = await getPublicPage("home");
  return page ? { kind: "page" as const, page } : { kind: "empty" as const };
}

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const r = await load();
  if (r.kind === "page") return buildPageMetadata(r.page, env().SITE_URL);
  const s = await getSiteSettings();
  // absolute: the homepage title is not suffixed with the site name template
  return {
    title: { absolute: s.homeTitle || s.defaultTitle }, description: s.homeDescription || s.defaultDescription,
    alternates: { canonical: "/" }, openGraph: { url: "/", title: s.homeTitle || s.defaultTitle, description: s.homeDescription || s.defaultDescription },
  };
}

async function HomeContent() {
  await connection();
  const [r, s, footer] = await Promise.all([load(), getSiteSettings(), getPublicFooter().catch(() => null)]);
  const ld = <JsonLd data={siteLd(env().SITE_URL, { siteName: s.siteName, logoUrl: s.logoUrl, sameAs: footer?.social.map((x) => x.url) ?? [] })} />;
  if (r.kind === "sections") return <>{ld}<HomeView sections={r.home.sections} /></>;
  if (r.kind === "page") return <>{ld}<PageView page={r.page} /></>;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      {ld}
      <h1 className="sr-only">{s.siteName}</h1>
      <Logo />
      <div className="divider-gold" />
      <p className="max-w-md text-muted">Our storefront is being prepared. Please check back soon.</p>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="flex-1" aria-busy="true" />}>
      <HomeContent />
    </Suspense>
  );
}
