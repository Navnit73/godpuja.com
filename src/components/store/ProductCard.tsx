/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { PublicProduct } from "@/server/services/products";
import { responsive } from "@/lib/image";
import { ArrowRight, LotusOrnament } from "./Icons";
import Stars from "./Stars";
import WishlistButton from "./WishlistButton";

export default function ProductCard({ p, className = "" }: { p: PublicProduct; className?: string }) {
  const off = p.salePrice != null && p.price > 0 ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
  return (
    <li className={`product-tile group relative ${className}`}>
      {/* Beside the link, not inside it: a button must not be nested in a link. */}
      <WishlistButton productId={p.id} name={p.name} compact />
      <Link href={`/product/${p.slug}`} className="flex h-full flex-col rounded-xl">
        <div className="relative overflow-hidden rounded-xl bg-sandal-100">
          {p.image
            ? <img {...responsive(p.image.url, "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 45vw", 320)} alt={p.image.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-square w-full object-cover transition-transform duration-500 ease-standard group-hover:scale-105" />
            : <div className="flex aspect-square w-full items-center justify-center bg-dawn" aria-hidden="true"><LotusOrnament className="h-6 w-24 text-sandal-400" /></div>}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {off > 0 && <span className="badge bg-kumkum-700 text-white">{off}% off</span>}
            {p.upcoming && <span className="badge bg-saffron-700 text-white">Coming soon</span>}
            {!p.upcoming && !p.inStock && <span className="badge bg-surface text-danger">Out of stock</span>}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-1 pb-1 pt-3">
          <h3 className="line-clamp-2 font-sans text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary sm:text-base">{p.name}</h3>
          {p.rating && <Stars avg={p.rating.avg} count={p.rating.count} />}
          <div className="mt-auto flex items-center justify-between gap-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold text-foreground">{formatMoney(p.salePrice ?? p.price)}</span>
              {p.salePrice != null && <s className="text-xs text-muted"><span className="sr-only">Was </span>{formatMoney(p.price)}</s>}
            </p>
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron-50 text-primary transition-colors duration-200 ease-standard group-hover:bg-primary group-hover:text-primary-foreground sm:inline-flex" aria-hidden="true">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
