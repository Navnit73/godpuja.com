import Link from "next/link";
import { listingHref, SORTS } from "@/lib/listing";
import { formatPaise } from "@/lib/money";
import type { PublicProductsInput } from "@/lib/validation/catalog";
import type { PublicProduct } from "@/server/services/products";
import { ChevronDown, CloseIcon } from "./Icons";
import Popover from "./Popover";
import ProductCard from "./ProductCard";
import SortSelect from "./SortSelect";

type Result = { items: PublicProduct[]; total: number; page: number; pages: number };

/** One-line toolbar (count, active filter, sort, price popover; a plain GET form that works without JavaScript)
 *  + product grid + pagination. */
export default function ProductListing({ base, query, result, hiddenFields = {}, heading = "Products" }: { base: string; query: PublicProductsInput; result: Result; hiddenFields?: Record<string, string>; heading?: string }) {
  const filtered = query.minPrice !== undefined || query.maxPrice !== undefined;
  const clearHref = listingHref(base, { ...query, minPrice: undefined, maxPrice: undefined, page: 1 }, hiddenFields);
  const priceLabel = query.minPrice !== undefined && query.maxPrice !== undefined ? `${formatPaise(query.minPrice)} – ${formatPaise(query.maxPrice)}`
    : query.minPrice !== undefined ? `From ${formatPaise(query.minPrice)}` : query.maxPrice !== undefined ? `Up to ${formatPaise(query.maxPrice)}` : "";
  return (
    <section aria-labelledby="listing-heading">
      <h2 id="listing-heading" className="sr-only">{heading}</h2>
      <div className="mb-6 flex flex-col gap-3 border-b border-sandal-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="text-sm text-muted"><span className="font-semibold text-foreground">{result.total}</span> {result.total === 1 ? "product" : "products"}</p>
          {filtered && (
            <Link href={clearHref} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-saffron-50 pl-3 pr-2 text-sm font-medium text-primary ring-1 ring-saffron-200 transition-colors hover:bg-saffron-100">
              {priceLabel}<CloseIcon className="h-4 w-4" /><span className="sr-only">Remove price filter</span>
            </Link>
          )}
        </div>
        <form method="get" action={base} aria-label="Sort and filter products" className="flex flex-wrap items-center gap-2">
          {Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {/* Native <details>: no JS needed; its inputs still submit with the form while it is closed. */}
          <Popover className="group/price relative">
            <summary className={`chip h-10 cursor-pointer summary-plain gap-1.5 ${filtered ? "border-primary text-primary" : ""}`}>
              Price<ChevronDown className="h-4 w-4 transition-transform duration-200 ease-standard group-open/price:rotate-180" />
            </summary>
            <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-sandal-200 bg-surface p-4 shadow-elev-4 sm:left-auto sm:right-0">
              <p className="mb-3 text-sm font-semibold text-foreground">Price range (₹)</p>
              <div className="flex items-end gap-2">
                <div className="flex-1"><label htmlFor="min" className="label">Min<span className="sr-only"> price (₹)</span></label><input id="min" name="min" inputMode="numeric" pattern="\d*" placeholder="0" defaultValue={query.minPrice !== undefined ? query.minPrice / 100 : ""} className="input" /></div>
                <span className="pb-2.5 text-muted" aria-hidden="true">–</span>
                <div className="flex-1"><label htmlFor="max" className="label">Max<span className="sr-only"> price (₹)</span></label><input id="max" name="max" inputMode="numeric" pattern="\d*" placeholder="Any" defaultValue={query.maxPrice !== undefined ? query.maxPrice / 100 : ""} className="input" /></div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                {filtered ? <Link href={clearHref} className="text-sm font-medium text-primary hover:underline">Clear</Link> : <span />}
                <button type="submit" className="btn-primary btn-sm">Apply</button>
              </div>
            </div>
          </Popover>
          <SortSelect value={query.sort} options={SORTS} />
          <noscript><button type="submit" className="btn-outline btn-sm">Apply</button></noscript>
        </form>
      </div>

      {result.items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-sandal-300 bg-surface px-6 py-16 text-center">
          <p className="text-lg font-semibold">No products found</p>
          <p className="mt-1 text-sm text-muted">{filtered ? "Try widening the price range." : "Please check back soon."}</p>
          {filtered && <Link href={clearHref} className="btn-outline mt-5">Clear price filter</Link>}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{result.items.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
      )}

      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3 border-t border-sandal-200 pt-6 text-sm">
          {result.page > 1 ? <Link rel="prev" className="btn-outline btn-sm" href={listingHref(base, query, { page: result.page - 1, ...hiddenFields })}>Previous</Link> : <span />}
          <p className="text-muted">Page <span className="font-semibold text-foreground">{result.page}</span> of {result.pages}</p>
          {result.page < result.pages ? <Link rel="next" className="btn-outline btn-sm" href={listingHref(base, query, { page: result.page + 1, ...hiddenFields })}>Next</Link> : <span />}
        </nav>
      )}
    </section>
  );
}
