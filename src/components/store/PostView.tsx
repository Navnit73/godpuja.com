/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { responsive } from "@/lib/image";
import { env } from "@/server/env";
import { getPublicPosts } from "@/server/public/pages";
import type { PublicPage } from "@/server/services/pages";
import Breadcrumbs from "./Breadcrumbs";
import { ArrowRight } from "./Icons";
import { Section } from "./PageView";

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

  const published = page.publishedAt && !page.isPreview;
  const chip = "inline-flex items-center gap-1.5 rounded-md bg-sandal-100 px-3 py-1.5 text-xs font-medium text-foreground";

  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-5 sm:px-6 lg:pt-8">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: sec.name, href: sec.href }, { name: page.title }]} />
        <div className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <article className="min-w-0">
            {page.isPreview && (
              <p role="status" className="mb-4 rounded-md border border-gold-300 bg-warning-soft px-3 py-2 text-sm text-warning">
                Preview — this post is not published and is hidden from search engines.
              </p>
            )}
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">{page.title}</h1>
            {page.description && <p className="mt-4 max-w-2xl text-lg text-muted">{page.description}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-saffron-100 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-saffron-800">{sec.label}</span>
              <span className={chip}>{page.readingMinutes} min read</span>
              {published && <span className={chip}><time dateTime={page.publishedAt!}>{formatDate(page.publishedAt!)}</time></span>}
            </div>

            {page.coverImageUrl && (
              <img {...responsive(page.coverImageUrl, "(min-width: 1280px) 760px, (min-width: 1024px) 60vw, 100vw", 1280)} alt={page.coverImageAlt} fetchPriority="high" referrerPolicy="no-referrer" className="mt-8 aspect-16/9 w-full rounded-lg object-cover" />
            )}

            <div className="mt-10 max-w-3xl space-y-10 sm:text-lg [&_.content]:sm:text-lg [&_.content]:sm:leading-8 [&_.content_h2]:font-display [&_.content_h3]:font-display [&_.content_blockquote]:rounded-md [&_.content_blockquote]:bg-saffron-100 [&_.content_blockquote]:py-3 [&_.content_blockquote]:pr-4 [&_.content_li]:marker:text-foreground">
              {page.sections.length
                ? page.sections.map((s) => <Section key={s.id} s={s} />)
                : <p className="text-muted">This post has no content yet.</p>}
            </div>

            <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-sandal-200 pt-6">
              <Link href={sec.href} className="inline-flex items-center gap-2 text-sm font-bold text-foreground underline-offset-4 hover:underline">
                <ArrowRight className="h-4 w-4 rotate-180" />{sec.back}
              </Link>
            </footer>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Article extras">
            {!page.isPreview && (
              <section className="rounded-lg bg-sandal-100 p-5">
                <h2 className="font-display text-base font-bold text-foreground">Share this {page.kind === "guide" ? "guide" : "post"}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <a className="chip" href={`https://wa.me/?text=${share}`} target="_blank" rel="noopener noreferrer">WhatsApp<span className="sr-only"> (opens in a new tab)</span></a>
                  <a className="chip" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook<span className="sr-only"> (opens in a new tab)</span></a>
                  <a className="chip" href={`https://twitter.com/intent/tweet?text=${share}`} target="_blank" rel="noopener noreferrer">X<span className="sr-only"> (opens in a new tab)</span></a>
                </div>
              </section>
            )}

            {related.length > 0 && (
              <section aria-labelledby="related-posts" className="rounded-lg bg-sandal-100 p-5">
                <h2 id="related-posts" className="font-display text-base font-bold text-foreground">{sec.more}</h2>
                <ul className="mt-4 space-y-4">
                  {related.map((p) => (
                    <li key={p.id} className="group flex gap-3">
                      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-sacred">
                        {p.coverImageUrl && <img {...responsive(p.coverImageUrl, "80px", 160)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        {p.publishedAt && <time dateTime={p.publishedAt} className="text-xs text-muted">{formatDate(p.publishedAt)}</time>}
                        <Link href={`/${p.slug}`} className="mt-0.5 line-clamp-2 block text-sm font-semibold leading-snug text-foreground group-hover:underline">{p.title}</Link>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link href={sec.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-foreground underline-offset-4 hover:underline">
                  View all<ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            <section className="rounded-lg bg-sacred p-6 text-sandal-200">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-white">Explore sacred essentials</h2>
              <p className="mt-2 text-sm">Authentic malas, puja samagri and more, blessed and delivered to your door.</p>
              <Link href="/shop" className="btn-primary mt-5 inline-flex">Shop now</Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
