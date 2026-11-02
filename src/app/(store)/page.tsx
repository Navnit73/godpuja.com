import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Logo from "@/components/Logo";
import PageView from "@/components/store/PageView";
import { buildPageMetadata } from "@/lib/seo";
import { env } from "@/server/env";
import { getPublicPage } from "@/server/public/pages";

// The homepage is the published CMS page with slug "home". Until one exists, show a neutral placeholder.
// Rendered at request time (the read itself is cached, 60 s) so the build never needs the database.
// Stage 7 replaces this with the full homepage section builder.
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const page = await getPublicPage("home");
  return page ? buildPageMetadata(page, env().SITE_URL) : {};
}

async function HomeContent() {
  await connection();
  const page = await getPublicPage("home");
  if (page) return <PageView page={page} />;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="sr-only">GodPuja</h1>
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
