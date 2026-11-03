import Link from "next/link";
import { listingHref, SORTS } from "@/lib/listing";
import type { PublicProductsInput } from "@/lib/validation/catalog";
import type { PublicProduct } from "@/server/services/products";
import ProductCard from "./ProductCard";

type Result = { items: PublicProduct[]; total: number; page: number; pages: number };

/** Filter/sort form (plain GET, works without JavaScript) + product grid + pagination. */
export default function ProductListing({ base, query, result, hiddenFields = {}, heading = "Products" }: { base: string; query: PublicProductsInput; result: Result; hiddenFields?: Record<string, string>; heading?: string }) {
  const filtered = query.minPrice !== undefined || query.maxPrice !== undefined;
  return (
    <section aria-labelledby="listing-heading">
      <h2 id="listing-heading" className="sr-only">{heading}</h2>
      <form method="get" action={base} aria-label="Sort and filter products" className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border border-sandal-200 bg-sandal-100 p-4 sm:p-5">
        {Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div><label htmlFor="sort" className="label">Sort by</label>
          <select id="sort" name="sort" defaultValue={query.sort} className="input rounded-full px-4 pr-8">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label htmlFor="min" className="label">Min price (₹)</label><input id="min" name="min" inputMode="numeric" pattern="\d*" defaultValue={query.minPrice !== undefined ? query.minPrice / 100 : ""} className="input w-28 rounded-full px-4" /></div>
        <div><label htmlFor="max" className="label">Max price (₹)</label><input id="max" name="max" inputMode="numeric" pattern="\d*" defaultValue={query.maxPrice !== undefined ? query.maxPrice / 100 : ""} className="input w-28 rounded-full px-4" /></div>
        <button type="submit" className="btn-primary h-10">Apply filters</button>
        {filtered && <Link href={listingHref(base, { ...query, minPrice: undefined, maxPrice: undefined, page: 1 }, hiddenFields)} className="btn-outline h-10">Clear price filter</Link>}
      </form>

      <p role="status" className="mb-4 text-sm text-muted">{result.total} {result.total === 1 ? "product" : "products"}</p>
      {result.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sandal-300 bg-surface px-6 py-16 text-center">
          <p className="text-lg font-semibold">No products found</p>
          <p className="mt-1 text-sm text-muted">{filtered ? "Try widening the price range." : "Please check back soon."}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{result.items.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
      )}

      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-between text-sm">
          <p className="text-muted">Page {result.page} of {result.pages}</p>
          <div className="flex gap-2">
            {result.page > 1 && <Link rel="prev" className="btn-outline btn-sm" href={listingHref(base, query, { page: result.page - 1, ...hiddenFields })}>Previous</Link>}
            {result.page < result.pages && <Link rel="next" className="btn-outline btn-sm" href={listingHref(base, query, { page: result.page + 1, ...hiddenFields })}>Next</Link>}
          </div>
        </nav>
      )}
    </section>
  );
}
