import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { findPublicPage } from "../services/pages";
import { invalidateMenus } from "./menus";

/**
 * Cached storefront read. `slug` is passed as an argument because cached scopes cannot read params.
 * Revalidates every 60 s so scheduled pages go live shortly after their publish time.
 */
export async function getPublicPage(slug: string) {
  "use cache";
  cacheTag("pages", `page:${slug}`);
  const page = await findPublicPage(slug);
  // Misses are cached briefly so junk URLs cannot fill the cache for an hour.
  cacheLife(page ? { stale: 60, revalidate: 60, expire: 3600 } : { stale: 15, revalidate: 15, expire: 60 });
  return page;
}

/** Call after any admin write that changes what the public sees. `expire: 0` => next request is fresh. */
export function invalidatePages(...slugs: (string | undefined)[]) {
  revalidateTag("pages", { expire: 0 });
  invalidateMenus(); // menus resolve page links, so a slug change / unpublish must refresh them too
  for (const s of new Set(slugs.filter(Boolean) as string[])) revalidateTag(`page:${s}`, { expire: 0 });
}
