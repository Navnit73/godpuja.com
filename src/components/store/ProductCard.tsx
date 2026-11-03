/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatPaise } from "@/lib/money";
import type { PublicProduct } from "@/server/services/products";
import { responsive } from "@/lib/image";
import { ArrowRight } from "./Icons";

export default function ProductCard({ p }: { p: PublicProduct }) {
  const off = p.salePrice != null && p.price > 0 ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
  return (
    <li className="product-tile group">
      <Link href={`/product/${p.slug}`} className="flex h-full flex-col">
        <div className="relative overflow-hidden rounded-xl bg-sandal-100">
          {p.image
            ? <img {...responsive(p.image.url, "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw", 320)} alt={p.image.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-square w-full object-cover transition-transform duration-300 ease-standard group-hover:scale-105" />
            : <div className="aspect-square w-full" aria-hidden="true" />}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {off > 0 && <span className="badge bg-kumkum-700 text-white">{off}% off</span>}
            {p.upcoming && <span className="badge bg-saffron-700 text-white">Coming soon</span>}
            {!p.upcoming && !p.inStock && <span className="badge bg-surface text-danger">Out of stock</span>}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-1 pt-3">
          <h3 className="line-clamp-2 font-sans text-sm font-medium leading-snug text-foreground group-hover:text-primary sm:text-base">{p.name}</h3>
          <div className="mt-auto flex items-end justify-between gap-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold text-foreground">{formatPaise(p.salePrice ?? p.price)}</span>
              {p.salePrice != null && <s className="text-xs text-muted"><span className="sr-only">Was </span>{formatPaise(p.price)}</s>}
            </p>
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors group-hover:bg-saffron-800 sm:inline-flex" aria-hidden="true">
              View <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
