/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { responsive } from "@/lib/image";
import type { PostCard as Post } from "@/server/services/pages";
import { LotusOrnament } from "./Icons";

/** Card for a blog post or guide: cover, kind label, title, date and summary. The whole card is one link. */
export default function PostCard({ p, showKind = false, headingLevel = 3 }: { p: Post; showKind?: boolean; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as const;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-sandal-200 bg-surface transition-shadow duration-200 ease-standard hover:shadow-elev-2">
      {p.coverImageUrl
        ? <img {...responsive(p.coverImageUrl, "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw", 640)} alt={p.coverImageAlt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-16/9 w-full object-cover" />
        : <div className="flex aspect-16/9 w-full items-center justify-center bg-dawn" aria-hidden="true"><LotusOrnament className="h-6 w-24 text-gold-400" /></div>}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {showKind && <>{p.kind === "guide" ? "Guide" : "Blog"}{p.publishedAt && " · "}</>}
          {p.publishedAt && <time dateTime={p.publishedAt}>{formatDate(p.publishedAt)}</time>}
        </p>
        <H className="mt-2 font-serif text-xl font-semibold text-foreground">
          {/* stretched link: the whole card is clickable, but only the title is announced */}
          <Link href={`/${p.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{p.title}</Link>
        </H>
        {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>}
      </div>
    </li>
  );
}
