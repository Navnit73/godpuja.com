import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { findPublicFooter } from "../services/footer";

/** Cached storefront read (60 s) — links to scheduled pages go live without a footer edit. */
export async function getPublicFooter() {
  "use cache";
  cacheTag("footer");
  const footer = await findPublicFooter();
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  return footer;
}

export const invalidateFooter = () => revalidateTag("footer", { expire: 0 });
