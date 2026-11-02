/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import { formatPaise } from "@/lib/money";
import type { PublicProduct } from "@/server/services/products";
import { responsive } from "@/lib/image";

export default function ProductCard({ p }: { p: PublicProduct }) {
  return (
    <li className="card flex flex-col overflow-hidden p-0">
      <Link href={`/product/${p.slug}`} className="group flex h-full flex-col">
        {p.image ? <img {...responsive(p.image.url, "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw", 320)} alt={p.image.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-sandal-100" aria-hidden="true" />}
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="font-sans text-base font-medium group-hover:text-primary">{p.name}</h3>
          <p className="mt-auto flex items-baseline gap-2">
            <span className="font-semibold">{formatPaise(p.salePrice ?? p.price)}</span>
            {p.salePrice != null && <s className="text-sm text-muted"><span className="sr-only">Was </span>{formatPaise(p.price)}</s>}
          </p>
          {!p.inStock && <p className="text-sm text-danger">Out of stock</p>}
        </div>
      </Link>
    </li>
  );
}
