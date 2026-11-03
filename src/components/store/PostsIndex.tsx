import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/jsonld";
import { env } from "@/server/env";
import { getPublicPosts } from "@/server/public/pages";
import PageBand from "./PageBand";
import { LotusOrnament } from "./Icons";
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
      <PageBand title={c.title} description={c.description} crumbs={[{ name: "Home", href: "/" }, { name: c.title }]}>
        <nav aria-label="Read" className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(COPY) as Kind[]).map((k) => (
            <Link key={k} href={COPY[k].path} aria-current={k === kind ? "page" : undefined}
              className={k === kind ? "inline-flex min-h-9 items-center rounded-full bg-gold-300 px-4 text-sm font-semibold text-kumkum-950" : "chip-dark"}>
              {COPY[k].title}
            </Link>
          ))}
        </nav>
      </PageBand>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        {result.items.length === 0
          ? (
            <div className="panel mx-auto flex max-w-xl flex-col items-center px-6 py-14 text-center">
              <LotusOrnament className="h-5 w-20 text-accent" />
              <p className="mt-4 font-serif text-2xl font-semibold">{c.empty}</p>
              <Link href="/" className="btn-primary mt-6">Back to the shop</Link>
            </div>
          )
          : <ul aria-label={c.title} className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {/* newest post leads page 1 as a wide, side-by-side card */}
              {result.items.map((p, i) => <PostCard key={p.id} p={p} headingLevel={2} featured={page === 1 && i === 0} />)}
            </ul>}
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
