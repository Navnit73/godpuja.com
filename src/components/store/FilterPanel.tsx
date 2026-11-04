import Link from "next/link";
import { FACET_KEYS, MIN_RATINGS } from "@/lib/facets";
import { listingHref } from "@/lib/listing";
import type { PublicProductsInput } from "@/lib/validation/catalog";
import type { FacetGroup } from "@/server/services/products";
import { CloseIcon } from "./Icons";

const linkCls = (on: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${on ? "border-primary bg-saffron-50 font-medium text-primary" : "border-input-border hover:bg-sandal-100"}`;

/**
 * Filters beyond price: availability, rating and the attribute facets that exist on the products being browsed. Plain
 * links (work without JavaScript, each state is a shareable URL). Selecting a chosen option again turns it off.
 */
export default function FilterPanel({ base, query, facets, hiddenFields = {} }: { base: string; query: PublicProductsInput; facets: FacetGroup[]; hiddenFields?: Record<string, string> }) {
  const href = (over: Record<string, string | number | undefined>) => listingHref(base, query, { page: 1, ...over, ...hiddenFields });
  const active = FACET_KEYS.filter((k) => query[k]).length + (query.stock ? 1 : 0) + (query.rating ? 1 : 0);
  const clearAll = href({ stock: undefined, rating: undefined, ...Object.fromEntries(FACET_KEYS.map((k) => [k, undefined])) });
  return (
    <details className="mb-6 rounded-xl border border-sandal-200 bg-surface" open={active > 0}>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm font-medium">
        <span>Filters{active > 0 && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{active}<span className="sr-only"> applied</span></span>}</span>
      </summary>
      <div className="space-y-4 border-t border-sandal-200 px-4 py-4">
        <div>
          <h3 id="f-avail" className="mb-2 font-sans text-sm font-semibold">Availability</h3>
          <ul aria-labelledby="f-avail" className="flex flex-wrap gap-2"><li><Link href={href({ stock: query.stock ? undefined : "1" })} className={linkCls(!!query.stock)} aria-current={query.stock ? "true" : undefined} rel="nofollow">In stock only</Link></li></ul>
        </div>
        <div>
          <h3 id="f-rating" className="mb-2 font-sans text-sm font-semibold">Rating</h3>
          <ul aria-labelledby="f-rating" className="flex flex-wrap gap-2">
            {MIN_RATINGS.map((r) => <li key={r}><Link href={href({ rating: query.rating === r ? undefined : r })} className={linkCls(query.rating === r)} aria-current={query.rating === r ? "true" : undefined} rel="nofollow">{r} stars &amp; up</Link></li>)}
          </ul>
        </div>
        {facets.map((g) => (
          <div key={g.key}>
            <h3 id={`f-${g.key}`} className="mb-2 font-sans text-sm font-semibold">{g.name}</h3>
            <ul aria-labelledby={`f-${g.key}`} className="flex flex-wrap gap-2">
              {g.values.map((v) => {
                const on = query[g.key]?.toLowerCase() === v.value.toLowerCase();
                return <li key={v.value}><Link href={href({ [g.key]: on ? undefined : v.value })} className={linkCls(on)} aria-current={on ? "true" : undefined} rel="nofollow">{v.value} <span className="text-xs text-muted">({v.count})</span></Link></li>;
              })}
            </ul>
          </div>
        ))}
        {active > 0 && <Link href={clearAll} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><CloseIcon className="h-4 w-4" />Clear all filters</Link>}
      </div>
    </details>
  );
}
