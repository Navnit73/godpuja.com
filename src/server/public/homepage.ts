import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { findPublicHomepage } from "../services/homepage";

/**
 * Cached 60 s (offers expire by time). Tagged with the catalog and page tags too, so a product/category change refreshes
 * the rails immediately instead of waiting for the window.
 */
export async function getPublicHomepage() {
  "use cache";
  cacheTag("home", "products", "categories", "pages"); // "pages": publishing a blog post / guide refreshes "Latest posts"
  const home = await findPublicHomepage();
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  return home;
}

export const invalidateHomepage = () => revalidateTag("home", { expire: 0 });
