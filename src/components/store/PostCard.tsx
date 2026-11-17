/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { responsive } from "@/lib/image";
import type { PostCard as Post } from "@/server/services/pages";
import { ArrowRight } from "./Icons";

const KIND_LABEL = { blog: "Blog", guide: "Guide" } as const;

/** Shown when a post has no cover: flat ink panel with the kind label. */
function CoverFallback({ kind }: { kind: Post["kind"] }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-sacred" aria-hidden="true">
      <span className="font-display text-2xl font-extrabold tracking-tight text-white">{kind === "guide" ? "Puja Guide" : "GodPuja Blog"}</span>
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
    <li className={`group relative flex flex-col gap-5 ${featured ? "sm:col-span-2 lg:col-span-3 md:grid md:grid-cols-2 md:items-center md:gap-10" : ""}`}>
      <div className={`aspect-16/9 w-full overflow-hidden rounded-lg bg-sandal-100 ${featured ? "md:aspect-4/3" : ""}`}>
        {p.coverImageUrl
          ? <img {...responsive(p.coverImageUrl, featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw", featured ? 960 : 640)} alt={p.coverImageAlt} loading={featured ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 ease-standard group-hover:scale-[1.04]" />
          : <CoverFallback kind={p.kind} />}
      </div>
      <div className={`flex flex-1 flex-col ${featured ? "md:justify-center" : ""}`}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase tracking-widest text-foreground">
          {(showKind || featured) && <span className="rounded-sm bg-saffron-100 px-2 py-1 text-saffron-800">{featured ? `Latest ${KIND_LABEL[p.kind].toLowerCase()}` : KIND_LABEL[p.kind]}</span>}
          {p.publishedAt && <time dateTime={p.publishedAt} className="text-muted">{formatDate(p.publishedAt)}</time>}
        </p>
        <H className={`mt-3 font-display font-extrabold leading-snug tracking-tight text-foreground ${featured ? "text-3xl sm:text-4xl" : "text-xl"}`}>
          {/* stretched link: the whole card is clickable, but only the title is announced */}
          <Link href={`/${p.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent">{p.title}</Link>
        </H>
        {p.excerpt && <p className={`mt-2 text-muted ${featured ? "line-clamp-4 text-base sm:text-lg" : "line-clamp-3 text-sm"}`}>{p.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-foreground" aria-hidden="true">
          {p.kind === "guide" ? "Read the guide" : "Read more"}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </li>
  );
}
