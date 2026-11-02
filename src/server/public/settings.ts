import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { findSiteSettings } from "../services/settings";

export async function getSiteSettings() {
  "use cache";
  cacheTag("settings");
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 });
  return findSiteSettings();
}
export const invalidateSettings = () => revalidateTag("settings", { expire: 0 });
