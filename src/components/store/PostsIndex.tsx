import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/jsonld";
import { env } from "@/server/env";
import { getPublicPosts } from "@/server/public/pages";
import PageBand from "./PageBand";
import PostCard from "./PostCard";

type Kind = "blog" | "guide";
const COPY: Record<Kind, { title: string; path: string; description: string; empty: string }> = {
  blog: { title: "Blog", path: "/blog", description: "Stories, festival notes and puja tips from GodPuja.", empty: "No posts yet. Please check back soon." },
  guide: { title: "Guides", path: "/guides", description: "Step-by-step guides to pujas, rituals and the items they need.", empty: "No guides yet. Please check back soon." },
};
const PER_PAGE = 12;

const pageNo = (raw: string | string[] | undefined) => {
  const n = typeof raw === "string" && /^\d{1,4}$/.test(raw) ? Number(raw) : 1;
  return n >= 1 ? n : 1;
};

export async function postsIndexMetadata(kind: Kind, searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<Metadata> {
  await connection();
  const c = COPY[kind];
  const page = pageNo((await searchParams).page);
  const base = `${env().SITE_URL.replace(/\/$/, "")}${c.path}`;
  const canonical = page > 1 ? `${base}?page=${page}` : base;
  return {
    title: page > 1 ? `${c.title} — page ${page}` : c.title, description: c.description,
    alternates: { canonical }, openGraph: { type: "website", title: c.title, description: c.description, url: canonical },
  };
}

/** Public listing for /blog and /guides: newest first, 12 per page. */
export default async function PostsIndex({ kind, searchParams }: { kind: Kind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const c = COPY[kind];
  const page = pageNo((await searchParams).page);
  const result = await getPublicPosts(kind, page, PER_PAGE);
  if (page > 1 && page > result.pages) notFound();
  const href = (n: number) => (n > 1 ? `${c.path}?page=${n}` : c.path);
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <JsonLd data={breadcrumbLd(env().SITE_URL, [{ name: "Home", path: "/" }, { name: c.title, path: c.path }])} />
      <PageBand title={c.title} description={c.description} crumbs={[{ name: "Home", href: "/" }, { name: c.title }]} />
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        {result.items.length === 0
          ? <p className="py-12 text-center text-muted">{c.empty}</p>
          : <ul aria-label={c.title} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.items.map((p) => <PostCard key={p.id} p={p} headingLevel={2} />)}</ul>}
        {result.pages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-between text-sm">
            <p className="text-muted">Page {result.page} of {result.pages}</p>
            <div className="flex gap-2">
              {result.page > 1 && <Link className="btn-outline btn-sm" href={href(result.page - 1)} rel="prev">Newer</Link>}
              {result.page < result.pages && <Link className="btn-outline btn-sm" href={href(result.page + 1)} rel="next">Older</Link>}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}
