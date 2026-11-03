/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { responsive } from "@/lib/image";
import { env } from "@/server/env";
import { getPublicPosts } from "@/server/public/pages";
import type { PublicPage } from "@/server/services/pages";
import Breadcrumbs from "./Breadcrumbs";
import { ArrowRight, LotusOrnament, Mandala } from "./Icons";
import { Section } from "./PageView";
import PostCard from "./PostCard";

const SECTION_OF = {
  blog: { name: "Blog", href: "/blog", label: "Blog", more: "More from the blog", back: "All blog posts" },
  guide: { name: "Guides", href: "/guides", label: "Guide", more: "More guides", back: "All guides" },
} as const;

/** Article layout for blog posts and guides: dusk title band, overlapping cover, readable body, share + related posts. */
export default async function PostView({ page }: { page: PublicPage & { kind: "blog" | "guide" } }) {
  const sec = SECTION_OF[page.kind];
  // Related: newest of the same kind, minus this one. Cached and cheap; a failure must not take the article down.
  const related = await getPublicPosts(page.kind, 1, 4)
    .then((r) => r.items.filter((p) => p.slug !== page.slug).slice(0, 3))
    .catch(() => []);
  const url = `${env().SITE_URL.replace(/\/$/, "")}/${page.slug}`;
  const share = encodeURIComponent(`${page.title} ${url}`);

  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <article>
        <header className="relative isolate overflow-hidden bg-dusk text-sandal-200">
          <div className="pattern-rangoli absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
          <Mandala className="absolute -right-16 -top-20 -z-10 h-64 w-64 text-gold-300 opacity-15" />
          <div className={`mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6 sm:pt-6 ${page.coverImageUrl ? "pb-24 sm:pb-32" : "pb-7 sm:pb-9"}`}>
            <Breadcrumbs tone="dark" items={[{ name: "Home", href: "/" }, { name: sec.name, href: sec.href }, { name: page.title }]} />
            {page.isPreview && (
              <p role="status" className="mb-4 rounded-md border border-gold-300 bg-warning-soft px-3 py-2 text-sm text-warning">
                Preview — this post is not published and is hidden from search engines.
              </p>
            )}
            <h1 className="text-3xl font-semibold leading-tight text-sandal-50 text-balance sm:text-4xl">{page.title}</h1>
            {page.description && <p className="mt-2 text-base text-sandal-200 sm:text-lg">{page.description}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-sandal-300">
              <span className="rounded-full border border-gold-300/40 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-gold-300">{sec.label}</span>
              {page.publishedAt && !page.isPreview && <span>Published <time dateTime={page.publishedAt}>{formatDate(page.publishedAt)}</time></span>}
              {page.publishedAt && !page.isPreview && <span aria-hidden="true" className="text-gold-300">•</span>}
              <span>{page.readingMinutes} min read</span>
            </p>
          </div>
        </header>

        {page.coverImageUrl && (
          <div className="mx-auto -mt-16 w-full max-w-4xl px-4 sm:-mt-24 sm:px-6">
            <img {...responsive(page.coverImageUrl, "(min-width: 896px) 896px, 100vw", 1280)} alt={page.coverImageAlt} fetchPriority="high" referrerPolicy="no-referrer" className="aspect-16/9 w-full rounded-2xl object-cover shadow-elev-3 ring-1 ring-sandal-200" />
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="space-y-10 sm:text-lg [&_.content]:sm:text-lg [&_.content]:sm:leading-8">
            {page.sections.length
              ? page.sections.map((s) => <Section key={s.id} s={s} />)
              : <p className="text-muted">This post has no content yet.</p>}
          </div>

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-sandal-200 pt-6">
            <Link href={sec.href} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-saffron-700">
              <ArrowRight className="h-4 w-4 rotate-180" />{sec.back}
            </Link>
            {!page.isPreview && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Share:</span>
                <a className="chip" href={`https://wa.me/?text=${share}`} target="_blank" rel="noopener noreferrer">WhatsApp<span className="sr-only"> (opens in a new tab)</span></a>
                <a className="chip" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook<span className="sr-only"> (opens in a new tab)</span></a>
              </div>
            )}
          </footer>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related-posts" className="border-t border-sandal-200 bg-sandal-100">
          <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="related-posts" className="section-title">{sec.more}</h2>
                <LotusOrnament className="mt-2 h-4 w-16 text-accent" />
              </div>
              <Link href={sec.href} className="inline-flex items-center gap-1.5 rounded-full border border-saffron-200 bg-saffron-50 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground">
                View all<ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((p) => <PostCard key={p.id} p={p} />)}</ul>
          </div>
        </section>
      )}
    </main>
  );
}
