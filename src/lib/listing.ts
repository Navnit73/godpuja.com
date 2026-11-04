import { FACET_KEYS } from "./facets";
import { publicProductsSchema, type PublicProductsInput } from "./validation/catalog";

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export const SORTS = [
  ["newest", "Newest"], ["popular", "Popularity"], ["rating", "Top rated"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"],
] as const;

/** Visitor-facing query string (prices in rupees) -> validated product query (paise). Bad values are ignored, never an error. */
export function parseListing(raw: Raw, extra: Partial<PublicProductsInput> = {}) {
  const rupees = (v?: string) => (v && /^\d{1,7}$/.test(v) ? Number(v) * 100 : undefined);
  const facets = Object.fromEntries(FACET_KEYS.map((k) => [k, one(raw[k])]));
  const candidate = { sort: one(raw.sort), minPrice: rupees(one(raw.min)), maxPrice: rupees(one(raw.max)), page: one(raw.page), q: one(raw.q), stock: one(raw.stock), rating: one(raw.rating), ...facets, ...extra };
  const r = publicProductsSchema.safeParse(candidate);
  if (r.success) return r.data;
  // drop the offending fields one by one so a single bad param does not blank the whole page
  const bad = new Set(r.error.issues.map((i) => String(i.path[0])));
  const cleaned = Object.fromEntries(Object.entries(candidate).filter(([k]) => !bad.has(k) || k in extra));
  return publicProductsSchema.parse(cleaned);
}

/** True when any filter or non-default sort is on (such pages are near-duplicates: noindex, canonical = the plain listing). */
export const isFiltered = (q: PublicProductsInput) =>
  q.sort !== "newest" || q.minPrice !== undefined || q.maxPrice !== undefined || !!q.stock || q.rating !== undefined || FACET_KEYS.some((k) => !!q[k]);

/** Builds a link that keeps the current filters. Empty values are omitted. */
export function listingHref(base: string, q: PublicProductsInput, over: Record<string, string | number | undefined> = {}) {
  const p = new URLSearchParams();
  const cur: Record<string, string | number | undefined> = {
    q: q.q, sort: q.sort === "newest" ? undefined : q.sort, min: q.minPrice !== undefined ? q.minPrice / 100 : undefined,
    max: q.maxPrice !== undefined ? q.maxPrice / 100 : undefined, page: q.page > 1 ? q.page : undefined,
    stock: q.stock, rating: q.rating, ...Object.fromEntries(FACET_KEYS.map((k) => [k, q[k]])), ...over,
  };
  for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && !(k === "page" && Number(v) <= 1)) p.set(k, String(v));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
