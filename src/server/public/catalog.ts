import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { findCategoryTree } from "../services/categories";
import { findPublicProduct } from "../services/products";

export async function getCategoryTree() {
  "use cache";
  cacheTag("categories");
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  return findCategoryTree();
}

export async function getPublicProduct(slug: string) {
  "use cache";
  cacheTag("products", `product:${slug}`);
  const p = await findPublicProduct(slug);
  cacheLife(p ? { stale: 30, revalidate: 60, expire: 3600 } : { stale: 15, revalidate: 15, expire: 60 });
  return p;
}

/** Category edits can move/hide products too, so they refresh both tags. */
export function invalidateCategories() {
  revalidateTag("categories", { expire: 0 });
  revalidateTag("products", { expire: 0 });
}
export function invalidateProducts(...slugs: (string | undefined)[]) {
  revalidateTag("products", { expire: 0 });
  for (const s of new Set(slugs.filter(Boolean) as string[])) revalidateTag(`product:${s}`, { expire: 0 });
}
