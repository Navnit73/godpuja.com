import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { findPublicVidhi, findPublicVidhiList } from "../services/vidhi";
import { invalidateMenus } from "./menus";
import type { VidhiCategory } from "@/lib/validation/vidhi";

/** Cached storefront read. 60 s window so a scheduled guide goes live shortly after its time. Misses are cached briefly. */
export async function getPublicVidhi(slug: string) {
  "use cache";
  cacheTag("vidhi", `vidhi:${slug}`);
  const v = await findPublicVidhi(slug);
  cacheLife(v ? { stale: 60, revalidate: 60, expire: 3600 } : { stale: 15, revalidate: 15, expire: 60 });
  return v;
}

export async function getPublicVidhiList(category: VidhiCategory | undefined, page: number, limit = 12) {
  "use cache";
  cacheTag("vidhi");
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  return findPublicVidhiList({ category, page, limit });
}

/** Call after any admin write that changes what the public sees. Product edits that affect a guide's links expire on their own within a minute. */
export function invalidateVidhi(...slugs: (string | undefined)[]) {
  revalidateTag("vidhi", { expire: 0 });
  invalidateMenus();
  for (const s of new Set(slugs.filter(Boolean) as string[])) revalidateTag(`vidhi:${s}`, { expire: 0 });
}
