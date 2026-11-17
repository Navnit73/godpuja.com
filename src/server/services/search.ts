import { connectDB } from "../db";
import { Category } from "../models/Category";
import { categorySnapshot } from "./category-snapshot";
import { findPublicDevotionalList, type DevotionalCard } from "./devotional";
import { findPublicPosts, type PostCard } from "./pages";
import { suggestProducts, type PublicProduct } from "./products";
import { findPublicVidhiList, type VidhiCard } from "./vidhi";
import { DEVOTIONAL_TYPE_KEYS } from "@/lib/validation/devotional";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Suggestions = {
  q: string;
  products: Pick<PublicProduct, "id" | "name" | "slug" | "image" | "price" | "salePrice" | "inStock">[];
  categories: { name: string; path: string }[];
  vidhi: Pick<VidhiCard, "slug" | "title" | "categoryLabel">[];
  devotionals: Pick<DevotionalCard, "slug" | "type" | "title" | "typeLabel" | "deity" | "hasAudio">[];
  posts: Pick<PostCard, "slug" | "title" | "kind">[];
  total: number;
};

/** Search text as typed: collapsed spaces, capped length. Fewer than 2 characters is "nothing to search". */
export const cleanQuery = (raw: string) => raw.replace(/\s+/g, " ").trim().slice(0, 60);

/** Everything the header's type-ahead shows, in one call. All sources apply their own "live and visible" rules. */
export async function suggestAll(raw: string): Promise<Suggestions> {
  const q = cleanQuery(raw);
  const empty: Suggestions = { q, products: [], categories: [], vidhi: [], devotionals: [], posts: [], total: 0 };
  if (q.length < 2) return empty;
  await connectDB();
  const [products, cats, vidhi, devs, posts] = await Promise.all([
    suggestProducts(q, 5),
    Category.find({ isActive: true, name: new RegExp(`(^|\\s)${escapeRegex(q)}`, "i") }).select("name path").sort({ path: 1 }).limit(6).lean(),
    findPublicVidhiList({ q, limit: 3 }),
    findPublicDevotionalList({ types: DEVOTIONAL_TYPE_KEYS, q, limit: 4 }),
    findPublicPosts("all", { q, limit: 3 }),
  ]);
  const snap = await categorySnapshot();
  const hidden = new Set(snap.hidden.map(String));
  const categories = cats.filter((c) => !hidden.has(String(c._id))).slice(0, 4).map((c) => ({ name: c.name, path: c.path }));
  const out: Suggestions = {
    q,
    products: products.map((p) => ({ id: p.id, name: p.name, slug: p.slug, image: p.image, price: p.price, salePrice: p.salePrice, inStock: p.inStock })),
    categories,
    vidhi: vidhi.items.map((v) => ({ slug: v.slug, title: v.title, categoryLabel: v.categoryLabel })),
    devotionals: devs.items.map((d) => ({ slug: d.slug, type: d.type, title: d.title, typeLabel: d.typeLabel, deity: d.deity, hasAudio: d.hasAudio })),
    posts: posts.items.map((p) => ({ slug: p.slug, title: p.title, kind: p.kind })),
    total: 0,
  };
  out.total = out.products.length + out.categories.length + out.vidhi.length + out.devotionals.length + out.posts.length;
  return out;
}

/** Counts per content type for the results-page tabs (products are counted by the product listing itself). */
export async function contentCounts(raw: string) {
  const q = cleanQuery(raw);
  if (q.length < 2) return { vidhi: 0, devotional: 0, posts: 0 };
  const [v, d, p] = await Promise.all([
    findPublicVidhiList({ q, limit: 1 }), findPublicDevotionalList({ types: DEVOTIONAL_TYPE_KEYS, q, limit: 1 }), findPublicPosts("all", { q, limit: 1 }),
  ]);
  return { vidhi: v.total, devotional: d.total, posts: p.total };
}
