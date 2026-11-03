import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { renderMarkdown } from "../markdown";
import { Category } from "../models/Category";
import { Homepage, type HomepageDoc } from "../models/Homepage";
import { findPublicPosts, type PostCard } from "./pages";
import { findRail, loadCategoryIndex, type PublicProduct } from "./products";
import { homeSectionSchema, type HomepageInput, type HomeSection, type UpdateHomepageInput } from "@/lib/validation/homepage";

export type AdminHomepage = HomepageInput & { updatedAt: string | null };

/** Until the first save there is no document; the editor starts empty (`updatedAt: null`). */
export async function getHomepage(): Promise<AdminHomepage> {
  await connectDB();
  const d = await Homepage.findOne({ key: "main" }).lean();
  return { sections: d?.sections ?? [], updatedAt: d ? d.updatedAt.toISOString() : null };
}

export async function updateHomepage({ baseUpdatedAt, sections }: UpdateHomepageInput): Promise<AdminHomepage> {
  await connectDB();
  const stale = new ApiError("CONFLICT", "The homepage was changed by someone else. Reload to see their changes before saving.");
  let saved: HomepageDoc | null;
  if (baseUpdatedAt === null) {
    try {
      saved = (await Homepage.create({ key: "main", sections })).toObject() as HomepageDoc; // create-only: unique key
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw stale;
      throw err;
    }
  } else {
    saved = await Homepage.findOneAndUpdate({ key: "main", updatedAt: new Date(baseUpdatedAt) }, { $set: { sections } }, { returnDocument: "after" }).lean();
    if (!saved) throw stale;
  }
  return { sections: saved.sections, updatedAt: saved.updatedAt.toISOString() };
}

// ---------- Public (storefront) ----------

type Rail = { id: string; type: "featuredProducts" | "latestProducts" | "bestSellers"; heading: string; products: PublicProduct[]; viewAll: string | null };
export type PublicHomeSection =
  | { id: string; type: "hero"; heading: string; subheading: string; imageUrl: string; imageAlt: string; ctaLabel: string; ctaUrl: string; secondaryCtaLabel: string; secondaryCtaUrl: string }
  | { id: string; type: "banner"; items: { imageUrl: string; imageAlt: string; heading: string; text: string; linkUrl: string }[] }
  | { id: string; type: "featuredCategories"; heading: string; categories: { id: string; name: string; path: string; image: { url: string; alt: string } }[] }
  | ({ type: "featuredProducts" | "latestProducts" | "bestSellers" } & Rail)
  | { id: string; type: "richText"; html: string }
  | { id: string; type: "imageText"; heading: string; bodyHtml: string; imageUrl: string; imageAlt: string; imagePosition: "left" | "right"; ctaLabel: string; ctaUrl: string }
  | { id: string; type: "testimonials"; heading: string; items: { quote: string; author: string; role: string }[] }
  | { id: string; type: "offer"; heading: string; text: string; code: string; ctaLabel: string; ctaUrl: string }
  | { id: string; type: "custom"; html: string; tone: "plain" | "soft" | "accent" }
  | { id: string; type: "latestPosts"; heading: string; posts: PostCard[]; viewAll: string | null; showKind: boolean };
export type PublicHomepage = { sections: PublicHomeSection[] };

const isRail = (s: HomeSection): s is Extract<HomeSection, { type: "featuredProducts" | "latestProducts" | "bestSellers" }> =>
  s.type === "featuredProducts" || s.type === "latestProducts" || s.type === "bestSellers";

/**
 * Turns the stored section list into what visitors see. Disabled sections, expired offers, empty rails and
 * categories that are inactive/deleted are dropped. Needed data is fetched in batches: ONE category query for
 * all category sections, and one indexed limited query per product rail (run in parallel, at most 6).
 */
export async function findPublicHomepage(now = new Date()): Promise<PublicHomepage | null> {
  await connectDB();
  const doc = await Homepage.findOne({ key: "main" }).lean();
  if (!doc) return null;
  // Stored data is re-validated: a hand-edited or older-shaped section is skipped instead of breaking the whole page.
  const sections: HomeSection[] = [];
  for (const raw of doc.sections ?? []) {
    const r = homeSectionSchema.safeParse(raw);
    if (!r.success) { console.error("[homepage] skipping invalid stored section", (raw as { id?: string })?.id); continue; }
    if (r.data.enabled) sections.push(r.data);
  }

  const wantedIds = [...new Set(sections.flatMap((s) => (s.type === "featuredCategories" ? s.data.categoryIds : [])))].filter((i) => mongoose.isValidObjectId(i));
  const hasRails = sections.some(isRail);
  const [cats, index] = await Promise.all([
    wantedIds.length ? Category.find({ _id: { $in: wantedIds }, isActive: true }).select("name path parent image").lean() : [],
    hasRails ? loadCategoryIndex() : null,
  ]);
  // A category is shown only if its whole ancestor chain is active.
  const activeAncestors = async () => {
    const parts = cats.flatMap((c) => c.path.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/")));
    const blocked = parts.length ? await Category.find({ path: { $in: [...new Set(parts)] }, isActive: false }).select("path").lean() : [];
    return new Set(blocked.map((b) => b.path));
  };
  const blocked = cats.length ? await activeAncestors() : new Set<string>();
  const catById = new Map(cats.filter((c) => ![...blocked].some((b) => c.path.startsWith(b + "/"))).map((c) => [String(c._id), c]));
  const catPath = index?.catPath ?? new Map<string, string>();

  const railResults = new Map<string, PublicProduct[]>();
  const postResults = new Map<string, PostCard[]>();
  await Promise.all([
    ...sections.filter(isRail).map(async (s) => railResults.set(s.id, await findRail({ kind: s.type, category: s.data.category, limit: s.data.limit }, catPath, index?.hidden))),
    ...sections.flatMap((s) => (s.type === "latestPosts" ? [s] : [])).map(async (s) => postResults.set(s.id, (await findPublicPosts(s.data.kind, { limit: s.data.limit }, now)).items)),
  ]);

  const out: PublicHomeSection[] = [];
  for (const s of sections) {
    switch (s.type) {
      case "hero": out.push({ id: s.id, type: "hero", ...s.data }); break;
      case "banner": out.push({ id: s.id, type: "banner", items: s.data.items }); break;
      case "featuredCategories": {
        const list = s.data.categoryIds.flatMap((i) => { const c = catById.get(i); return c ? [{ id: i, name: c.name, path: c.path, image: { url: c.image?.url ?? "", alt: c.image?.alt ?? "" } }] : []; });
        if (list.length) out.push({ id: s.id, type: "featuredCategories", heading: s.data.heading, categories: list });
        break;
      }
      case "featuredProducts": case "latestProducts": case "bestSellers": {
        const products = railResults.get(s.id) ?? [];
        if (products.length) out.push({ id: s.id, type: s.type, heading: s.data.heading, products, viewAll: s.data.category ? `/category/${s.data.category}` : null });
        break;
      }
      case "richText": { const html = renderMarkdown(s.data.markdown); if (s.data.markdown.trim()) out.push({ id: s.id, type: "richText", html }); break; }
      case "imageText": out.push({ id: s.id, type: "imageText", heading: s.data.heading, bodyHtml: renderMarkdown(s.data.markdown), imageUrl: s.data.imageUrl, imageAlt: s.data.imageAlt, imagePosition: s.data.imagePosition, ctaLabel: s.data.ctaLabel, ctaUrl: s.data.ctaUrl }); break;
      case "testimonials": out.push({ id: s.id, type: "testimonials", heading: s.data.heading, items: s.data.items }); break;
      case "offer": {
        if (s.data.expiresAt && new Date(s.data.expiresAt) <= now) break; // expired offers disappear without an edit
        out.push({ id: s.id, type: "offer", heading: s.data.heading, text: s.data.text, code: s.data.code, ctaLabel: s.data.ctaLabel, ctaUrl: s.data.ctaUrl });
        break;
      }
      case "custom": if (s.data.markdown.trim()) out.push({ id: s.id, type: "custom", html: renderMarkdown(s.data.markdown), tone: s.data.tone }); break;
      case "latestPosts": {
        const posts = postResults.get(s.id) ?? [];
        const viewAll = s.data.kind === "blog" ? "/blog" : s.data.kind === "guide" ? "/guides" : null;
        if (posts.length) out.push({ id: s.id, type: "latestPosts", heading: s.data.heading, posts, viewAll, showKind: s.data.kind === "all" });
        break;
      }
    }
  }
  return { sections: out };
}
