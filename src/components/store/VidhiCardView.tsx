/* eslint-disable @next/next/no-img-element -- remote CMS images from any host */
import Link from "next/link";
import { responsive } from "@/lib/image";
import { vidhiHref } from "@/lib/validation/vidhi";
import type { VidhiCard } from "@/server/services/vidhi";
import { LotusOrnament } from "./Icons";

/** A guide in a list: cover, category, title, a short excerpt. */
export default function VidhiCardView({ v, className = "" }: { v: VidhiCard; className?: string }) {
  return (
    <li className={`product-tile group ${className}`}>
      <Link href={vidhiHref(v.slug)} className="flex h-full flex-col rounded-xl">
        <div className="relative overflow-hidden rounded-xl bg-sandal-100">
          {v.cover
            ? <img {...responsive(v.cover.url, "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 90vw", 400)} alt={v.cover.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-standard group-hover:scale-105" />
            : <div className="flex aspect-[4/3] w-full items-center justify-center bg-dawn" aria-hidden="true"><LotusOrnament className="h-6 w-24 text-sandal-400" /></div>}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1 pt-3">
          <p className="eyebrow">{v.categoryLabel}{v.deity && ` · ${v.deity}`}</p>
          <h3 className="line-clamp-2 font-sans text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">{v.title}</h3>
          {v.excerpt && <p className="line-clamp-3 text-sm text-muted">{v.excerpt}</p>}
          {v.durationMinutes && <p className="mt-auto pt-1 text-xs text-muted">About {v.durationMinutes} min</p>}
        </div>
      </Link>
    </li>
  );
}
