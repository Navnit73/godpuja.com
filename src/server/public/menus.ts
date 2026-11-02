import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { findPublicMenu } from "../services/menus";

/**
 * Cached storefront read. Revalidates every 60 s because a menu entry can point at a scheduled page that goes live
 * (or a page that expires/unpublishes) without any menu edit.
 */
export async function getPublicMenu(key: string) {
  "use cache";
  cacheTag("nav", `menu:${key}`);
  const menu = await findPublicMenu(key);
  cacheLife(menu ? { stale: 60, revalidate: 60, expire: 3600 } : { stale: 15, revalidate: 15, expire: 60 });
  return menu;
}

/** Call after a menu write, or any page change that can alter resolved links. */
export function invalidateMenus(...keys: (string | undefined)[]) {
  revalidateTag("nav", { expire: 0 });
  for (const k of new Set(keys.filter(Boolean) as string[])) revalidateTag(`menu:${k}`, { expire: 0 });
}
