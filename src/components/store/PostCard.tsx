/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { responsive } from "@/lib/image";
import type { PostCard as Post } from "@/server/services/pages";
import { ArrowRight, LotusOrnament, Mandala } from "./Icons";

const KIND_LABEL = { blog: "Blog", guide: "Guide" } as const;

/** Shown when a post has no cover: warm sacred panel with a faint mandala and the kind label. */
function CoverFallback({ kind }: { kind: Post["kind"] }) {
  return (
    <div className="relative isolate flex h-full w-full items-center justify-center overflow-hidden bg-sacred" aria-hidden="true">
      <div className="pattern-rangoli absolute inset-0 -z-10 opacity-50" />
      <Mandala className="absolute -right-10 -top-10 -z-10 h-56 w-56 text-gold-300 opacity-20 transition-transform duration-500 ease-standard group-hover:rotate-12" />
      <div className="flex flex-col items-center gap-2 text-sandal-50">
        <LotusOrnament className="h-5 w-20 text-gold-300" />
        <span className="font-serif text-2xl font-semibold tracking-wide">{kind === "guide" ? "Puja Guide" : "GodPuja Blog"}</span>
      </div>
    </div>
  );
}

/**
 * Card for a blog post or guide. The whole card is one link (stretched title link).
 * `featured` lays it out side by side on wide screens, for the newest post at the top of a listing.
 */
export default function PostCard({ p, showKind = false, headingLevel = 3, featured = false }: { p: Post; showKind?: boolean; headingLevel?: 2 | 3; featured?: boolean }) {
  const H = `h${headingLevel}` as const;
  return (
    <li className={`group relative flex flex-col overflow-hidden rounded-2xl border border-sandal-200 bg-surface transition-all duration-200 ease-standard hover:-translate-y-0.5 hover:border-saffron-300 hover:shadow-elev-2 ${featured ? "sm:col-span-2 lg:col-span-3 md:grid md:grid-cols-2" : ""}`}>
      <div className={`aspect-16/9 w-full overflow-hidden bg-sandal-100 ${featured ? "md:aspect-auto md:h-full md:min-h-72" : ""}`}>
        {p.coverImageUrl
          ? <img {...responsive(p.coverImageUrl, featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw", featured ? 960 : 640)} alt={p.coverImageAlt} loading={featured ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 ease-standard group-hover:scale-105" />
          : <CoverFallback kind={p.kind} />}
      </div>
      <div className={`flex flex-1 flex-col p-5 sm:p-6 ${featured ? "md:justify-center md:p-10" : ""}`}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-widest text-primary">
          {(showKind || featured) && <span className="rounded-full bg-saffron-50 px-2.5 py-1 text-saffron-800 ring-1 ring-saffron-200">{featured ? `Latest ${KIND_LABEL[p.kind].toLowerCase()}` : KIND_LABEL[p.kind]}</span>}
          {p.publishedAt && <time dateTime={p.publishedAt} className="text-muted">{formatDate(p.publishedAt)}</time>}
        </p>
        <H className={`mt-3 font-serif font-semibold leading-snug text-foreground ${featured ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}>
          {/* stretched link: the whole card is clickable, but only the title is announced */}
          <Link href={`/${p.slug}`} className="transition-colors after:absolute after:inset-0 group-hover:text-primary focus-visible:outline-none after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent">{p.title}</Link>
        </H>
        {p.excerpt && <p className={`mt-2 text-muted ${featured ? "line-clamp-4 text-base sm:text-lg" : "line-clamp-3 text-sm"}`}>{p.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-primary" aria-hidden="true">
          {p.kind === "guide" ? "Read the guide" : "Read more"}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </li>
  );
}
