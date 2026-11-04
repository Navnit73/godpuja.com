import { connectDB } from "../db";
import { Category } from "../models/Category";
import { Page } from "../models/Page";
import { Product } from "../models/Product";
import { findVidhiForSitemap } from "./vidhi";

export type SitemapEntry = { path: string; lastModified: Date };
const MAX_URLS = 50_000; // sitemap protocol limit per file

/**
 * Every indexable public URL: live CMS pages, visible categories (whole ancestor chain active) and active products
 * outside hidden categories — minus anything marked noindex. Drafts, previews and private routes never appear.
 */
export async function findSitemapEntries(now = new Date()): Promise<SitemapEntry[]> {
  await connectDB();
  const [pages, cats] = await Promise.all([
    Page.find({ $or: [{ status: "published" }, { status: "scheduled", publishAt: { $lte: now } }], "seo.noindex": { $ne: true } }).select("kind slug updatedAt").lean(),
    Category.find().select("path isActive seo.noindex updatedAt").lean(),
  ]);
  const inactive = cats.filter((c) => c.isActive === false).map((c) => c.path);
  const hidden = (path: string) => inactive.some((p) => path === p || path.startsWith(p + "/"));
  const hiddenIds = cats.filter((c) => hidden(c.path)).map((c) => c._id);
  const products = await Product.find({ status: { $in: ["active", "upcoming"] }, "seo.noindex": { $ne: true }, ...(hiddenIds.length ? { category: { $nin: hiddenIds } } : {}) })
    .select("slug updatedAt").sort({ updatedAt: -1 }).limit(MAX_URLS).lean();

  const out: SitemapEntry[] = [{ path: "/", lastModified: now }, { path: "/shop", lastModified: products[0]?.updatedAt ?? now }];
  for (const p of pages) if (p.slug !== "home") out.push({ path: `/${p.slug}`, lastModified: p.updatedAt });
  // Index pages for blog / guides, listed once there is at least one live item; lastModified = newest item.
  for (const [kind, path] of [["blog", "/blog"], ["guide", "/guides"]] as const) {
    const items = pages.filter((p) => p.kind === kind);
    if (items.length) out.push({ path, lastModified: new Date(Math.max(...items.map((p) => p.updatedAt.getTime()))) });
  }
  for (const c of cats) if (!hidden(c.path) && !c.seo?.noindex) out.push({ path: `/shop/${c.path}`, lastModified: c.updatedAt });
  for (const p of products) out.push({ path: `/product/${p.slug}`, lastModified: p.updatedAt });
  const guides = await findVidhiForSitemap(now);
  if (guides.length) out.push({ path: "/pooja-vidhi", lastModified: guides[0].updatedAt });
  for (const g of guides) out.push({ path: `/pooja-vidhi/${g.slug}`, lastModified: g.updatedAt });
  return out.slice(0, MAX_URLS);
}
