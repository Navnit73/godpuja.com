/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { PublicProduct } from "@/server/services/products";
import { responsive } from "@/lib/image";
import Stars from "./Stars";
import WishlistButton from "./WishlistButton";

/** Flat product tile: mist image plate with the offer tag, then name, rating and price. No border or shadow. */
export default function ProductCard({ p, className = "" }: { p: PublicProduct; className?: string }) {
  const off = p.salePrice != null && p.price > 0 ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
  return (
    <li className={`product-tile group relative ${className}`}>
      {/* Beside the link, not inside it: a button must not be nested in a link. */}
      <WishlistButton productId={p.id} name={p.name} compact />
      <Link href={`/product/${p.slug}`} className="flex h-full flex-col gap-3 rounded-lg">
        <div className="relative overflow-hidden rounded-lg bg-sandal-100">
          {p.image
            ? <img {...responsive(p.image.url, "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 45vw", 320)} alt={p.image.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-square w-full object-cover transition-transform duration-500 ease-standard group-hover:scale-[1.04]" />
            : <div className="flex aspect-square w-full items-center justify-center font-sans text-5xl font-semibold text-sandal-400" aria-hidden="true">ॐ</div>}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {off > 0 && <span className="badge bg-cta font-display font-bold text-cta-foreground">{off}% off</span>}
            {p.upcoming && <span className="badge bg-kumkum-900 text-white">Coming soon</span>}
            {!p.upcoming && !p.inStock && <span className="badge bg-surface text-danger">Out of stock</span>}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-foreground sm:text-base">{p.name}</h3>
          {p.rating && <Stars avg={p.rating.avg} count={p.rating.count} />}
          <p className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
            <span className="font-display text-base font-extrabold text-foreground sm:text-lg">{formatMoney(p.salePrice ?? p.price)}</span>
            {p.salePrice != null && <s className="text-sm text-muted"><span className="sr-only">Was </span>{formatMoney(p.price)}</s>}
          </p>
        </div>
      </Link>
    </li>
  );
}
