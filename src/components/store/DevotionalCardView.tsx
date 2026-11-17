/* eslint-disable @next/next/no-img-element -- remote CMS images from any host */
import Link from "next/link";
import { responsive } from "@/lib/image";
import { devotionalHref } from "@/lib/validation/devotional";
import type { DevotionalCard } from "@/server/services/devotional";
import { LotusOrnament } from "./Icons";

/** An aarti or mantra in a list: cover, kind and deity, title, a short excerpt, and an "Audio" badge when a licensed recording is offered. */
export default function DevotionalCardView({ d }: { d: DevotionalCard }) {
  return (
    <li className="product-tile group">
      <Link href={devotionalHref(d.type, d.slug)} className="flex h-full flex-col rounded-xl">
        <div className="relative overflow-hidden rounded-xl bg-sandal-100">
          {d.cover
            ? <img {...responsive(d.cover.url, "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 90vw", 400)} alt={d.cover.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-standard group-hover:scale-105" />
            : <div className="flex aspect-[4/3] w-full items-center justify-center bg-dawn" aria-hidden="true"><LotusOrnament className="h-6 w-24 text-sandal-400" /></div>}
          {d.hasAudio && <span className="badge-primary absolute left-2 top-2">Audio</span>}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1 pt-3">
          <p className="eyebrow">{d.typeLabel}{d.deity && ` · ${d.deity}`} · {d.languageLabel}</p>
          <h3 className="line-clamp-2 font-sans text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">{d.title}</h3>
          {d.excerpt && <p className="line-clamp-2 text-sm text-muted">{d.excerpt}</p>}
        </div>
      </Link>
    </li>
  );
}
