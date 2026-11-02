import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { env } from "@/server/env";
import { findSitemapEntries } from "@/server/services/sitemap";

async function entries() {
  "use cache";
  cacheTag("pages", "products", "categories");
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  return (await findSitemapEntries()).map((e) => ({ path: e.path, lastModified: e.lastModified.toISOString() }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // generated at request time (cached), so builds never need the database
  const base = env().SITE_URL.replace(/\/$/, "");
  return (await entries()).map((e) => ({ url: `${base}${e.path}`, lastModified: e.lastModified }));
}
