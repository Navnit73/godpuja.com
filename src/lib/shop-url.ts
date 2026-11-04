// Shared (client + server safe). Public store URLs (PRD v1.1 §3.1): /shop/ lists everything, /shop/<category path>/ a category.
// Products stay at /product/<slug>. Before Stage 14 categories lived at /category/<path>; those URLs get a permanent redirect.
export const SHOP = "/shop";
export const categoryHref = (path: string) => `${SHOP}/${path}`;

/** "/category/a/b" -> "/shop/a/b", "/category" -> "/shop". Anything else -> null. */
export function legacyToShop(pathname: string): string | null {
  const m = /^\/category(\/.*)?$/i.exec(pathname);
  if (!m) return null;
  return m[1] && m[1] !== "/" ? `${SHOP}${m[1]}` : SHOP;
}
