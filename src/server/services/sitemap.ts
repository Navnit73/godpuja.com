import { connectDB } from "../db";
import { Category } from "../models/Category";
import { Page } from "../models/Page";
import { Product } from "../models/Product";

export type SitemapEntry = { path: string; lastModified: Date };
const MAX_URLS = 50_000; // sitemap protocol limit per file

/**
 * Every indexable public URL: live CMS pages, visible categories (whole ancestor chain active) and active products
 * outside hidden categories — minus anything marked noindex. Drafts, previews and private routes never appear.
 */
export async function findSitemapEntries(now = new Date()): Promise<SitemapEntry[]> {
  await connectDB();
  const [pages, cats] = await Promise.all([
    Page.find({ $or: [{ status: "published" }, { status: "scheduled", publishAt: { $lte: now } }], "seo.noindex": { $ne: true } }).select("slug updatedAt").lean(),
    Category.find().select("path isActive seo.noindex updatedAt").lean(),
  ]);
  const inactive = cats.filter((c) => c.isActive === false).map((c) => c.path);
  const hidden = (path: string) => inactive.some((p) => path === p || path.startsWith(p + "/"));
  const hiddenIds = cats.filter((c) => hidden(c.path)).map((c) => c._id);
  const products = await Product.find({ status: "active", "seo.noindex": { $ne: true }, ...(hiddenIds.length ? { category: { $nin: hiddenIds } } : {}) })
    .select("slug updatedAt").sort({ updatedAt: -1 }).limit(MAX_URLS).lean();

  const out: SitemapEntry[] = [{ path: "/", lastModified: now }];
  for (const p of pages) if (p.slug !== "home") out.push({ path: `/${p.slug}`, lastModified: p.updatedAt });
  for (const c of cats) if (!hidden(c.path) && !c.seo?.noindex) out.push({ path: `/category/${c.path}`, lastModified: c.updatedAt });
  for (const p of products) out.push({ path: `/product/${p.slug}`, lastModified: p.updatedAt });
  return out.slice(0, MAX_URLS);
}
