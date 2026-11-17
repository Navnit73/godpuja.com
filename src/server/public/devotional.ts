import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { findPublicDevotional, findPublicDevotionalList, type PublicListQuery } from "../services/devotional";
import { invalidateMenus } from "./menus";
import type { DevotionalType } from "@/lib/validation/devotional";

/** Cached storefront read. 60 s window: a scheduled item goes live, and audio whose rights just expired disappears, within about a minute. */
export async function getPublicDevotional(slug: string, types: readonly DevotionalType[]) {
  "use cache";
  cacheTag("devotional", `devotional:${slug}`);
  const v = await findPublicDevotional(slug, types);
  cacheLife(v ? { stale: 60, revalidate: 60, expire: 3600 } : { stale: 15, revalidate: 15, expire: 60 });
  return v;
}

export async function getPublicDevotionalList(query: PublicListQuery) {
  "use cache";
  cacheTag("devotional");
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  return findPublicDevotionalList(query);
}

export function invalidateDevotional(...slugs: (string | undefined)[]) {
  revalidateTag("devotional", { expire: 0 });
  invalidateMenus();
  for (const s of new Set(slugs.filter(Boolean) as string[])) revalidateTag(`devotional:${s}`, { expire: 0 });
}
